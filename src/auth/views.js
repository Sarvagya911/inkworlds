// Sign in, sign up with an emailed code, Google sign-in and password reset pages.
import { AFTER, destination, rememberDestination } from './session.js';
import { THEMES, ensureFonts, fontStack } from '../config/themes.js';
import { mountMini } from '../engine/scenes/stage.js';
import { $, esc, toast } from '../lib/utils.js';
import { session } from '../services/session.js';
import { configured, supabase } from '../services/supabase.js';

export function friendly(e) {
  const m = (e && e.message) || '';
  if (/invalid login credentials/i.test(m))
    return "That email and password don't match. Try again, or sign in with a code instead.";
  if (/email not confirmed/i.test(m)) return "This email isn't verified yet. Request a new code below.";
  if (/(token|otp).*(expired|invalid)|(expired|invalid).*(token|otp)/i.test(m))
    return 'That code is wrong or has expired. Request a new one.';
  if (/rate limit|too many|security purposes/i.test(m))
    return 'Too many attempts. Wait a minute, then try again.';
  if (/signups not allowed|user not found/i.test(m))
    return 'No account uses that email yet. Create one first.';
  if (/already registered/i.test(m)) return 'An account already uses this email. Sign in instead.';
  return m || 'Something went wrong. Try again.';
}

export const notReady = () =>
  `<div class="empty-box">This copy of Inkworlds isn't connected to Supabase yet. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your environment, then rebuild.</div>`;

export function shell(app, { title, lede, body, world = 'gothic' }) {
  const t = THEMES[world];
  app.innerHTML = `<section class="view"><div class="auth-grid">
    <div class="window auth-art" aria-hidden="true"><canvas id="authCv"></canvas><div class="cap"><div class="wn" style="font-family:${esc(fontStack(t.title, 'title'))}">${esc(t.name)}</div><div class="wl">Your library follows you to every device.</div></div></div>
    <div class="auth-card"><h1 class="page-title">${title}</h1>${lede ? `<p class="lede" style="margin-bottom:1.2rem">${lede}</p>` : ''}
      ${configured ? body : notReady()}<p class="auth-err" id="authErr" role="alert" hidden></p></div></div></section>`;
  ensureFonts([t.body]);
  mountMini($('authCv'), world);
}

export const err = m => {
  const e = $('authErr');
  if (!e) return;
  e.textContent = m;
  e.hidden = !m;
};

export const googleBtn = () =>
  `<button class="btn ghost wide" id="googleBtn" type="button">Continue with Google</button><div class="or"><span>or</span></div>`;

export function wireGoogle() {
  const b = $('googleBtn');
  if (!b) return;
  b.addEventListener('click', async () => {
    b.disabled = true;
    err('');
    if (!sessionStorage.getItem(AFTER)) rememberDestination('#/library');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname }
    });
    if (error) {
      err(friendly(error));
      b.disabled = false;
    }
  });
}

export function busyBtn(btn, on, label) {
  btn.disabled = on;
  if (label) btn.textContent = label;
}

export function setOtp(email, mode) {
  sessionStorage.setItem('iw:otp', JSON.stringify({ email, mode, sent: Date.now() }));
}

export function getOtp() {
  try {
    return JSON.parse(sessionStorage.getItem('iw:otp') || 'null');
  } catch (e) {
    return null;
  }
}

export function viewSignIn(app) {
  shell(app, {
    title: 'Sign in',
    lede: 'Pick up your books, highlights and progress on any device.',
    body: `${googleBtn()}
    <form class="auth-form" id="f" novalidate>
      <label>Email<input class="input" type="email" id="em" autocomplete="email" required></label>
      <label>Password<input class="input" type="password" id="pw" autocomplete="current-password" required></label>
      <button class="btn wide" id="go" type="submit">Sign in</button>
    </form>
    <p class="auth-links"><a href="#/code">Email me a sign-in code instead</a><a href="#/forgot">Forgot password?</a></p>
    <p class="muted">New to Inkworlds? <a href="#/signup">Create an account</a></p>`
  });
  if (!configured) return;
  wireGoogle();
  $('f').addEventListener('submit', async e => {
    e.preventDefault();
    err('');
    const email = $('em').value.trim(),
      password = $('pw').value;
    if (!email || !password) {
      err('Enter your email and password.');
      return;
    }
    busyBtn($('go'), true, 'Signing in…');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      busyBtn($('go'), false, 'Sign in');
      if (/email not confirmed/i.test(error.message)) {
        setOtp(email, 'signup');
        await supabase.auth.resend({ type: 'signup', email });
        location.hash = '#/verify';
        return;
      }
      err(friendly(error));
      return;
    }
    location.hash = destination();
  });
}

export function viewSignUp(app) {
  shell(app, {
    title: 'Create your account',
    lede: 'Free, and your private books stay private.',
    world: 'parchment',
    body: `${googleBtn()}
    <form class="auth-form" id="f" novalidate>
      <label>Your name<input class="input" id="nm" autocomplete="name" maxlength="60" required></label>
      <label>Email<input class="input" type="email" id="em" autocomplete="email" required></label>
      <label>Password<input class="input" type="password" id="pw" autocomplete="new-password" minlength="8" required><span class="hint">At least 8 characters.</span></label>
      <button class="btn wide" id="go" type="submit">Create account</button>
    </form>
    <p class="muted">We'll email you a code to confirm it's you. Already have an account? <a href="#/signin">Sign in</a></p>`
  });
  if (!configured) return;
  wireGoogle();
  $('f').addEventListener('submit', async e => {
    e.preventDefault();
    err('');
    const full_name = $('nm').value.trim(),
      email = $('em').value.trim(),
      password = $('pw').value;
    if (!full_name) {
      err('Enter your name.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      err('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      err('Use a password with at least 8 characters.');
      return;
    }
    busyBtn($('go'), true, 'Creating account…');
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name } } });
    busyBtn($('go'), false, 'Create account');
    if (error) {
      err(friendly(error));
      return;
    }
    if (data.session) {
      location.hash = destination();
      return;
    } // email confirmation is switched off
    setOtp(email, 'signup');
    location.hash = '#/verify';
  });
}

export function viewCodeSignIn(app) {
  shell(app, {
    title: 'Sign in with a code',
    lede: "Enter your email and we'll send you a one-time code. No password needed.",
    world: 'victorian',
    body: `
    <form class="auth-form" id="f" novalidate>
      <label>Email<input class="input" type="email" id="em" autocomplete="email" required></label>
      <button class="btn wide" id="go" type="submit">Send code</button>
    </form><p class="muted"><a href="#/signin">Sign in with a password</a></p>`
  });
  if (!configured) return;
  $('f').addEventListener('submit', async e => {
    e.preventDefault();
    err('');
    const email = $('em').value.trim();
    if (!email) {
      err('Enter your email.');
      return;
    }
    busyBtn($('go'), true, 'Sending…');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    busyBtn($('go'), false, 'Send code');
    if (error) {
      err(friendly(error));
      return;
    }
    setOtp(email, 'email');
    location.hash = '#/verify';
  });
}

export function viewForgot(app) {
  shell(app, {
    title: 'Reset your password',
    lede: "We'll email you a code, then you can choose a new password.",
    world: 'forest',
    body: `
    <form class="auth-form" id="f" novalidate>
      <label>Email<input class="input" type="email" id="em" autocomplete="email" required></label>
      <button class="btn wide" id="go" type="submit">Send code</button>
    </form><p class="muted"><a href="#/signin">Back to sign in</a></p>`
  });
  if (!configured) return;
  $('f').addEventListener('submit', async e => {
    e.preventDefault();
    err('');
    const email = $('em').value.trim();
    if (!email) {
      err('Enter your email.');
      return;
    }
    busyBtn($('go'), true, 'Sending…');
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    busyBtn($('go'), false, 'Send code');
    if (error) {
      err(friendly(error));
      return;
    }
    setOtp(email, 'recovery');
    location.hash = '#/verify';
  });
}

export function viewVerify(app) {
  const o = getOtp();
  if (!o) {
    location.hash = '#/signin';
    return;
  }
  const titles = {
    signup: 'Confirm your email',
    email: 'Enter your sign-in code',
    recovery: 'Enter your reset code'
  };
  shell(app, {
    title: titles[o.mode],
    lede: `We sent a code to <b>${esc(o.email)}</b>. It can take a minute to arrive, so check your spam folder too.`,
    world: 'cosmos',
    body: `
    <form class="auth-form" id="f" novalidate>
      <label>Code<input class="input otp" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" pattern="[0-9]*" required></label>
      <button class="btn wide" id="go" type="submit">Verify</button>
    </form>
    <p class="auth-links"><button class="linkbtn" id="resend" type="button">Send a new code</button><a href="#/signin">Use a different email</a></p>`
  });
  if (!configured) return;
  $('code').focus();
  const type = o.mode === 'signup' ? 'signup' : o.mode === 'recovery' ? 'recovery' : 'email';
  $('f').addEventListener('submit', async e => {
    e.preventDefault();
    err('');
    const token = $('code').value.replace(/\D/g, '');
    if (token.length < 6) {
      err('Enter the full code from the email.');
      return;
    }
    busyBtn($('go'), true, 'Checking…');
    const { error } = await supabase.auth.verifyOtp({ email: o.email, token, type });
    busyBtn($('go'), false, 'Verify');
    if (error) {
      err(friendly(error));
      return;
    }
    sessionStorage.removeItem('iw:otp');
    if (o.mode === 'recovery') {
      location.hash = '#/reset';
      return;
    }
    toast(o.mode === 'signup' ? 'Your account is ready.' : 'Signed in.');
    location.hash = destination();
  });
  const rs = $('resend');
  let until = (o.sent || 0) + 60000;
  const tick = () => {
    const left = Math.ceil((until - Date.now()) / 1000);
    rs.disabled = left > 0;
    rs.textContent = left > 0 ? `Send a new code in ${left}s` : 'Send a new code';
    if (left > 0 && document.body.contains(rs)) setTimeout(tick, 1000);
  };
  tick();
  rs.addEventListener('click', async () => {
    err('');
    rs.disabled = true;
    const r =
      o.mode === 'signup'
        ? await supabase.auth.resend({ type: 'signup', email: o.email })
        : o.mode === 'recovery'
          ? await supabase.auth.resetPasswordForEmail(o.email)
          : await supabase.auth.signInWithOtp({ email: o.email, options: { shouldCreateUser: false } });
    if (r.error) {
      err(friendly(r.error));
      rs.disabled = false;
      return;
    }
    until = Date.now() + 60000;
    setOtp(o.email, o.mode);
    toast('A new code is on its way.');
    tick();
  });
}

export function viewReset(app) {
  shell(app, {
    title: 'Choose a new password',
    world: 'forest',
    body: session.user
      ? `
    <form class="auth-form" id="f" novalidate>
      <label>New password<input class="input" type="password" id="pw" autocomplete="new-password" minlength="8" required><span class="hint">At least 8 characters.</span></label>
      <label>Type it again<input class="input" type="password" id="pw2" autocomplete="new-password" required></label>
      <button class="btn wide" id="go" type="submit">Save new password</button>
    </form>`
      : `<p class="muted">Your reset link or code has expired. <a href="#/forgot">Request a new one</a>.</p>`
  });
  if (!configured || !session.user) return;
  $('f').addEventListener('submit', async e => {
    e.preventDefault();
    err('');
    const p1 = $('pw').value,
      p2 = $('pw2').value;
    if (p1.length < 8) {
      err('Use at least 8 characters.');
      return;
    }
    if (p1 !== p2) {
      err("The two passwords don't match.");
      return;
    }
    busyBtn($('go'), true, 'Saving…');
    const { error } = await supabase.auth.updateUser({ password: p1 });
    busyBtn($('go'), false, 'Save new password');
    if (error) {
      err(friendly(error));
      return;
    }
    toast('Password updated.');
    location.hash = '#/library';
  });
}
