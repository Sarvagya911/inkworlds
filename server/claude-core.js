// // Shared handler for the AI features, used by both the Vercel and the Netlify function.
// // The Anthropic key never reaches the browser. Each call is checked against the
// // signed-in user's Supabase session and a per-user daily quota.
// const json = (status, body) =>
//   new Response(JSON.stringify(body), {
//     status,
//     headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
//   });

// export async function handleClaude(request, env) {
//   if (request.method !== 'POST') return json(405, { code: 'method', message: 'Use POST.' });
//   const key = env.ANTHROPIC_API_KEY;
//   const sbUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
//   const sbKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
//   const model = env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
//   const limit = parseInt(env.AI_DAILY_LIMIT || '30', 10);
//   if (!key || !sbUrl || !sbKey)
//     return json(503, { code: 'not_configured', message: "AI features aren't set up on this site yet." });

//   const auth = request.headers.get('authorization') || '';
//   if (!auth.startsWith('Bearer ')) return json(401, { code: 'signin', message: 'Sign in to use this.' });

//   // Verifies the session and counts the call in one round trip (runs as the user).
//   const quota = await fetch(`${sbUrl}/rest/v1/rpc/ai_quota_hit`, {
//     method: 'POST',
//     headers: { apikey: sbKey, authorization: auth, 'content-type': 'application/json' },
//     body: JSON.stringify({ p_limit: limit })
//   });
//   if (quota.status === 401 || quota.status === 403)
//     return json(401, { code: 'signin', message: 'Your session expired. Sign in again.' });
//   if (!quota.ok) {
//     const t = await quota.text();
//     if (/daily AI limit/i.test(t))
//       return json(429, { code: 'limit', message: "You've reached today's limit for AI features." });
//     return json(502, { code: 'quota', message: 'Could not check your AI quota. Try again.' });
//   }

//   let body;
//   try {
//     body = await request.json();
//   } catch (e) {
//     return json(400, { code: 'bad_request', message: 'Invalid request.' });
//   }
//   const title = String(body.title || '').slice(0, 200),
//     text = String(body.text || '');
//   let prompt, maxTokens;
//   if (body.kind === 'world') {
//     const options = body.options && typeof body.options === 'object' ? body.options : {};
//     const keys = Object.keys(options).slice(0, 20);
//     if (!keys.length) return json(400, { code: 'bad_request', message: 'No worlds to choose from.' });
//     prompt = `Pick the visual reading "world" that best fits this book's setting and mood.\nOptions (key: description):\n${keys.map(k => `${k}: ${String(options[k]).slice(0, 160)}`).join('\n')}\n\nReply with JSON only, in exactly this shape: {"theme": "<one key from the list>", "reason": "<one short sentence about the book's setting or mood>"}\n\nTitle: ${title}\n\nOpening text:\n${text.slice(0, 3500)}`;
//     maxTokens = 200;
//     const out = await callClaude(key, model, prompt, maxTokens);
//     if (out.error) return json(502, { code: 'ai', message: out.error });
//     try {
//       const parsed = JSON.parse((out.text.match(/\{[\s\S]*\}/) || ['{}'])[0]);
//       if (!keys.includes(parsed.theme)) throw 0;
//       return json(200, { theme: parsed.theme, reason: String(parsed.reason || '').slice(0, 200) });
//     } catch (e) {
//       return json(502, { code: 'ai', message: "Claude couldn't pick a world this time." });
//     }
//   }
//   if (body.kind === 'companion') {
//     const task = String(body.task || '').slice(0, 300);
//     const instruction =
//       task === 'recap'
//         ? 'Catch the reader up: summarize what has happened so far in 5 to 8 sentences, spending the most on the latest chapter, and remind them who the main characters are.'
//         : `Answer the reader's question: ${task}`;
//     prompt = `You are a reading companion for the book "${title}". Below is ONLY the part of the book the reader has read so far. Use nothing else: do not use outside knowledge of this book, and never reveal, hint at or guess events after the point where the text stops. If the answer isn't in the text so far, say it hasn't come up yet. Write in plain prose, no headings or lists.\n\nTask: ${instruction}\n\nText read so far:\n${text.slice(-16000)}`;
//     const out = await callClaude(key, model, prompt, 700);
//     if (out.error) return json(502, { code: 'ai', message: out.error });
//     return json(200, { text: out.text });
//   }
//   return json(400, { code: 'bad_request', message: 'Unknown request.' });
// }

// async function callClaude(key, model, prompt, maxTokens) {
//   try {
//     const r = await fetch('https://api.anthropic.com/v1/messages', {
//       method: 'POST',
//       headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
//       body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
//     });
//     const data = await r.json();
//     if (!r.ok) return { error: (data.error && data.error.message) || 'The AI service returned an error.' };
//     return {
//       text: (data.content || [])
//         .filter(b => b.type === 'text')
//         .map(b => b.text)
//         .join('')
//         .trim()
//     };
//   } catch (e) {
//     return { error: 'Could not reach the AI service.' };
//   }
// }
// Shared handler for the AI features, used by both the Vercel and the Netlify function.
// The Groq key never reaches the browser. Each call is checked against the
// signed-in user's Supabase session and a per-user daily quota.

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store'
    }
  });

export async function handleClaude(request, env) {
  if (request.method !== 'POST') {
    return json(405, {
      code: 'method',
      message: 'Use POST.'
    });
  }

  const key = env.GROQ_API_KEY;
  const sbUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const sbKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  const model = env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const limit = parseInt(env.AI_DAILY_LIMIT || '30', 10);

  if (!key || !sbUrl || !sbKey) {
    return json(503, {
      code: 'not_configured',
      message: "AI features aren't set up on this site yet."
    });
  }

  const auth = request.headers.get('authorization') || '';

  if (!auth.startsWith('Bearer ')) {
    return json(401, {
      code: 'signin',
      message: 'Sign in to use this.'
    });
  }

  // Verifies the session and counts the call in one round trip (runs as the user).
  const quota = await fetch(`${sbUrl}/rest/v1/rpc/ai_quota_hit`, {
    method: 'POST',
    headers: {
      apikey: sbKey,
      authorization: auth,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      p_limit: limit
    })
  });

  if (quota.status === 401 || quota.status === 403) {
    return json(401, {
      code: 'signin',
      message: 'Your session expired. Sign in again.'
    });
  }

  if (!quota.ok) {
    const t = await quota.text();

    if (/daily AI limit/i.test(t)) {
      return json(429, {
        code: 'limit',
        message: "You've reached today's limit for AI features."
      });
    }

    return json(502, {
      code: 'quota',
      message: 'Could not check your AI quota. Try again.'
    });
  }


  let body;

  try {
    body = await request.json();
  } catch (e) {
    return json(400, {
      code: 'bad_request',
      message: 'Invalid request.'
    });
  }

  const title = String(body.title || '').slice(0, 200);
  const text = String(body.text || '');

  let prompt;
  let maxTokens;

  // ---------------------------------------------------------
  // WORLD PICKER
  // ---------------------------------------------------------

  if (body.kind === 'world') {
    const options =
      body.options && typeof body.options === 'object'
        ? body.options
        : {};

    const keys = Object.keys(options).slice(0, 20);

    if (!keys.length) {
      return json(400, {
        code: 'bad_request',
        message: 'No worlds to choose from.'
      });
    }

    prompt = `Pick the visual reading "world" that best fits this book's setting and mood.
Options (key: description):
${keys
  .map(
    k => `${k}: ${String(options[k]).slice(0, 160)}`
  )
  .join('\n')}

Reply with JSON only, in exactly this shape:
{"theme": "<one key from the list>", "reason": "<one short sentence about the book's setting or mood>"}

Title: ${title}

Opening text:
${text.slice(0, 3500)}`;

    maxTokens = 200;

    const out = await callClaude(key, model, prompt, maxTokens);

    if (out.error) {
      return json(502, {
        code: 'ai',
        message: out.error
      });
    }

    try {
      const parsed = JSON.parse(
        (out.text.match(/\{[\s\S]*\}/) || ['{}'])[0]
      );

      if (!keys.includes(parsed.theme)) {
        throw new Error('Invalid theme');
      }

      return json(200, {
        theme: parsed.theme,
        reason: String(parsed.reason || '').slice(0, 200)
      });
    } catch (e) {
      return json(502, {
        code: 'ai',
        message: "AI couldn't pick a world this time."
      });
    }
  }

  // ---------------------------------------------------------
  // READING COMPANION
  // ---------------------------------------------------------

  if (body.kind === 'companion') {
    const task = String(body.task || '').slice(0, 300);

    const instruction =
      task === 'recap'
        ? 'Catch the reader up: summarize what has happened so far in 5 to 8 sentences, spending the most on the latest chapter, and remind them who the main characters are.'
        : `Answer the reader's question: ${task}`;

    prompt = `You are a reading companion for the book "${title}". Below is ONLY the part of the book the reader has read so far. Use nothing else: do not use outside knowledge of this book, and never reveal, hint at or guess events after the point where the text stops. If the answer isn't in the text so far, say it hasn't come up yet. Write in plain prose, no headings or lists.

Task: ${instruction}

Text read so far:
${text.slice(-16000)}`;

    const out = await callClaude(key, model, prompt, 700);

    if (out.error) {
      return json(502, {
        code: 'ai',
        message: out.error
      });
    }

    return json(200, {
      text: out.text
    });
  }

  return json(400, {
    code: 'bad_request',
    message: 'Unknown request.'
  });
}


// ---------------------------------------------------------
// GROQ API CALL
// ---------------------------------------------------------

async function callClaude(key, model, prompt, maxTokens) {
  try {
    const r = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_completion_tokens: maxTokens,
          include_reasoning: false
        })
      }
    );

    const data = await r.json();

    if (!r.ok) {
      return {
        error:
          data.error?.message ||
          'The Groq AI service returned an error.'
      };
    }

    return {
      text:
        data.choices?.[0]?.message?.content?.trim() || ''
    };
  } catch (e) {
    return {
      error: 'Could not reach the Groq AI service.'
    };
  }
}