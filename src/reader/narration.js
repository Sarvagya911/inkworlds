import { cur } from './reader.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const canSpeak = !!(synth && typeof window.SpeechSynthesisUtterance === 'function');
const STORAGE_PREFIX = 'iw:narration:v2:';
const CHUNK_LIMIT = 900;

let paragraphs = [];
let chunks = [];
let chunkIndex = 0;
let utterance = null;
let utteranceToken = 0;
let currentCharOffset = 0;
let playing = false;
let voices = [];
let activeBookId = null;
let observer = null;

const $ = id => document.getElementById(id);

function makePlayer() {
  if ($('narrationToggle')) return;

  const topbar = document.querySelector('#topbar .row');
  const soundButton = $('soundBtn');
  if (!topbar || !soundButton) return;

  const toggle = document.createElement('button');
  toggle.className = 'tb narration-toggle';
  toggle.id = 'narrationToggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Listen to this book');
  toggle.innerHTML = '<span class="narration-toggle-icon" aria-hidden="true">▶</span><span class="lbl">Listen</span>';
  soundButton.insertAdjacentElement('afterend', toggle);

  const player = document.createElement('section');
  player.id = 'narrationPlayer';
  player.className = 'narration-player';
  player.hidden = true;
  player.setAttribute('aria-label', 'Book narration controls');
  player.innerHTML = `
    <div class="narration-topline">
      <div class="narration-now">
        <span class="narration-eyebrow">INKWORLDS AUDIO</span>
        <strong id="narrationChapter">Ready to listen</strong>
        <span id="narrationStatus" aria-live="polite">Free device narration</span>
      </div>
      <button type="button" class="narration-close" id="narrationClose" aria-label="Close narration player">×</button>
    </div>
    <div class="narration-progress"><i id="narrationProgress"></i></div>
    <div class="narration-controls">
      <button type="button" id="narrationPrevious" aria-label="Previous paragraph">↶</button>
      <button type="button" id="narrationPlay" class="narration-play" aria-label="Play narration">▶</button>
      <button type="button" id="narrationNext" aria-label="Next paragraph">↷</button>
      <label class="narration-speed">Speed
        <select id="narrationRate" aria-label="Narration speed">
          <option value="0.75">0.75×</option>
          <option value="0.9">0.9×</option>
          <option value="1" selected>1×</option>
          <option value="1.1">1.1×</option>
          <option value="1.25">1.25×</option>
          <option value="1.5">1.5×</option>
          <option value="1.75">1.75×</option>
          <option value="2">2×</option>
        </select>
      </label>
    </div>
    <label class="narration-voice">Voice
      <select id="narrationVoice" aria-label="Narrator voice">
        <option value="">System default</option>
      </select>
    </label>
    <p class="narration-footnote">Uses voices installed on your device. Voice availability varies by browser and operating system.</p>
  `;
  document.body.appendChild(player);

  toggle.addEventListener('click', () => {
    if (!cur || cur.meta.contentType === 'manga') return;
    player.hidden = !player.hidden;
    if (!player.hidden && !paragraphs.length) collectParagraphs();
  });
  $('narrationClose').addEventListener('click', () => {
    pause();
    player.hidden = true;
  });
  $('narrationPlay').addEventListener('click', () => {
    if (playing) pause();
    else play();
  });
  $('narrationPrevious').addEventListener('click', previous);
  $('narrationNext').addEventListener('click', next);
  $('narrationRate').addEventListener('change', () => {
    if (playing) restartCurrent();
  });
  $('narrationVoice').addEventListener('change', () => {
    if (playing) restartCurrent();
  });
}

function splitText(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_LIMIT) return [clean];

  const sentences = clean.match(/[^.!?]+[.!?]+[\])"'’”]*|[^.!?]+$/g) || [clean];
  const result = [];
  let current = '';

  for (const sentence of sentences) {
    const part = sentence.trim();
    if (!part) continue;
    if ((current + ' ' + part).trim().length > CHUNK_LIMIT && current) {
      result.push(current.trim());
      current = '';
    }
    if (part.length > CHUNK_LIMIT) {
      for (let i = 0; i < part.length; i += CHUNK_LIMIT) {
        if (current) result.push(current.trim());
        current = part.slice(i, i + CHUNK_LIMIT);
        if (current.length === CHUNK_LIMIT) {
          result.push(current);
          current = '';
        }
      }
    } else {
      current = (current + ' ' + part).trim();
    }
  }
  if (current) result.push(current.trim());
  return result;
}

function collectParagraphs() {
  if (!cur || cur.meta.contentType === 'manga') {
    paragraphs = [];
    chunks = [];
    return;
  }

  paragraphs = [...document.querySelectorAll('#pages [data-si]')]
    .filter(el => el.textContent.trim().length > 0);

  chunks = [];
  paragraphs.forEach((element, paragraphIndex) => {
    splitText(element.textContent).forEach(text => {
      chunks.push({ text, paragraphIndex });
    });
  });

  const saved = readProgress();
  chunkIndex = Math.min(saved, Math.max(0, chunks.length - 1));
  updateProgress();
}

function progressKey() {
  return activeBookId ? STORAGE_PREFIX + activeBookId : '';
}

function readProgress() {
  try {
    const value = Number(localStorage.getItem(progressKey()));
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch (_) {
    return 0;
  }
}

function saveProgress() {
  if (!progressKey()) return;
  try {
    localStorage.setItem(progressKey(), String(chunkIndex));
  } catch (_) {}
}

function selectedVoice() {
  const uri = $('narrationVoice')?.value;
  return voices.find(voice => voice.voiceURI === uri) || null;
}

function loadVoices() {
  if (!canSpeak) return;
  voices = synth.getVoices();
  const select = $('narrationVoice');
  if (!select) return;
  const previousValue = select.value;
  select.innerHTML = '<option value="">System default</option>';
  voices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} · ${voice.lang}${voice.default ? ' · Default' : ''}`;
    select.appendChild(option);
  });
  if (voices.some(voice => voice.voiceURI === previousValue)) {
    select.value = previousValue;
  }
}

function setStatus(message) {
  const status = $('narrationStatus');
  if (status) status.textContent = message;
}

function updateProgress() {
  const progress = $('narrationProgress');
  const chapter = $('narrationChapter');
  const playButton = $('narrationPlay');
  if (progress) {
    const percent = chunks.length ? (chunkIndex / chunks.length) * 100 : 0;
    progress.style.width = `${percent}%`;
  }
  if (chapter && cur) {
    const item = chunks[chunkIndex];
    const section = item && paragraphs[item.paragraphIndex]?.closest('.chapter');
    chapter.textContent = section?.querySelector('.ch-title')?.textContent || cur.meta.title || 'Ready to listen';
  }
  if (playButton) {
    playButton.textContent = playing ? 'Ⅱ' : '▶';
    playButton.setAttribute('aria-label', playing ? 'Pause narration' : 'Play narration');
  }
}

function highlightParagraph(index) {
  paragraphs.forEach((element, i) => element.classList.toggle('narration-active', i === index));
  const element = paragraphs[index];
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const section = element.closest('.chapter');
    if (section && $('narrationChapter')) {
      $('narrationChapter').textContent = section.querySelector('.ch-title')?.textContent || 'Now narrating';
    }
  }
}

function clearHighlight() {
  paragraphs.forEach(element => element.classList.remove('narration-active'));
}

function speakCurrent(cancelPrevious = true, startOffset = 0) {
  if (!canSpeak) {
    setStatus('Speech synthesis is not available in this browser.');
    return;
  }
  if (!chunks.length) {
    setStatus('No readable text found in this book.');
    return;
  }
  if (chunkIndex >= chunks.length) {
    chunkIndex = 0;
  }

  const token = ++utteranceToken;
  if (cancelPrevious) synth.cancel();
  const item = chunks[chunkIndex];
  const safeOffset = Math.max(0, Math.min(item.text.length, startOffset));
  currentCharOffset = safeOffset;
  highlightParagraph(item.paragraphIndex);

  utterance = new SpeechSynthesisUtterance(item.text.slice(safeOffset));
  utterance.rate = Number($('narrationRate')?.value || 1);
  const voice = selectedVoice();
  if (voice) utterance.voice = voice;

  utterance.onboundary = event => {
    if (token !== utteranceToken) return;
    if (Number.isFinite(event.charIndex)) {
      currentCharOffset = safeOffset + event.charIndex;
    }
  };
  utterance.onstart = () => {
    playing = true;
    setStatus('Narrating with your device voice');
    updateProgress();
  };
  utterance.onend = () => {
    if (!playing || token !== utteranceToken) return;
    chunkIndex += 1;
    saveProgress();
    if (chunkIndex < chunks.length) {
      updateProgress();
      // Chrome can drop immediately chained speech utterances. Yield briefly
      // before queuing the next segment, while guarding against pause/skip.
      window.setTimeout(() => {
        if (playing && token === utteranceToken) speakCurrent(false);
      }, 250);
    } else {
      playing = false;
      chunkIndex = chunks.length;
      saveProgress();
      clearHighlight();
      setStatus('Chapter text finished');
      updateProgress();
    }
  };
  utterance.onerror = event => {
    if (token !== utteranceToken || event.error === 'canceled' || event.error === 'interrupted') return;
    playing = false;
    setStatus('Narration stopped. Try another device voice.');
    updateProgress();
  };

  synth.speak(utterance);
  updateProgress();
}

function play() {
  if (!cur || cur.meta.contentType === 'manga') return;
  if (!canSpeak) {
    setStatus('This browser does not provide speech synthesis. Try a supported browser or device voice.');
    return;
  }
  // Re-read the live reader DOM on every explicit Play. The renderer can
  // replace chapter nodes after opening or changing the book.
  collectParagraphs();
  if (!chunks.length) {
    setStatus('No readable text found in this chapter.');
    return;
  }
  if (synth.paused) {
    synth.resume();
    playing = true;
    setStatus('Resumed');
    updateProgress();
    return;
  }
  playing = true;
  speakCurrent();
}

function pause() {
  utteranceToken += 1;
  if (synth) synth.cancel();
  playing = false;
  saveProgress();
  updateProgress();
  setStatus('Paused');
}

function restartCurrent() {
  if (!playing) return;
  // Chrome may dispatch the canceled utterance's completion asynchronously.
  // Invalidate it, cancel the old queue, then start the new-rate utterance
  // after the browser has cleared the previous speech task.
  const resumeAt = currentCharOffset;
  utteranceToken += 1;
  synth.cancel();
  window.setTimeout(() => {
    if (playing) speakCurrent(false, resumeAt);
  }, 180);
}

function previous() {
  if (!chunks.length) return;
  chunkIndex = Math.max(0, chunkIndex - 1);
  saveProgress();
  if (playing) speakCurrent();
  else {
    highlightParagraph(chunks[chunkIndex].paragraphIndex);
    updateProgress();
  }
}

function next() {
  if (!chunks.length) return;
  chunkIndex = Math.min(chunks.length - 1, chunkIndex + 1);
  saveProgress();
  if (playing) speakCurrent();
  else {
    highlightParagraph(chunks[chunkIndex].paragraphIndex);
    updateProgress();
  }
}

function refreshForCurrentBook() {
  const nextId = cur?.meta?.id || null;
  if (!nextId) {
    pause();
    activeBookId = null;
    paragraphs = [];
    chunks = [];
    clearHighlight();
    if ($('narrationPlayer')) $('narrationPlayer').hidden = true;
    if ($('narrationToggle')) $('narrationToggle').hidden = true;
    return;
  }

  if (cur.meta.contentType === 'manga') {
    pause();
    if ($('narrationToggle')) $('narrationToggle').hidden = true;
    if ($('narrationPlayer')) $('narrationPlayer').hidden = true;
    return;
  }

  if ($('narrationToggle')) $('narrationToggle').hidden = false;
  if (activeBookId !== nextId) {
    pause();
    activeBookId = nextId;
    collectParagraphs();
    setStatus('Free device narration');
  } else if (!paragraphs.length && document.querySelector('#pages .chapter')) {
    collectParagraphs();
  }
}

function init() {
  makePlayer();
  if (!canSpeak) {
    setStatus('Device narration is unavailable in this browser.');
  } else {
    loadVoices();
    synth.addEventListener?.('voiceschanged', loadVoices);
    // Some WebViews populate their voice list asynchronously without firing voiceschanged.
    setTimeout(loadVoices, 500);
  }

  const pages = $('pages');
  const reader = $('reader');
  if (pages && reader && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      if (!reader.hidden) refreshForCurrentBook();
      else if (activeBookId) refreshForCurrentBook();
    });
    observer.observe(pages, { childList: true, subtree: true });
    observer.observe(reader, { attributes: true, attributeFilter: ['hidden'] });
  }
  refreshForCurrentBook();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

document.addEventListener('visibilitychange', () => {
  // Do not cancel playback when the app is backgrounded; support varies by browser.
  if (document.visibilityState === 'visible' && playing && synth?.paused) {
    synth.resume();
  }
});

window.addEventListener('pagehide', saveProgress);
