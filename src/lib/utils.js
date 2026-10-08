// // Generic helpers and user preferences.
// /* ============================== Small utils ============================== */
// export const $ = id => document.getElementById(id);
// export const R = (a, b) => a + Math.random() * (b - a);
// export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// export const words = s => (s.match(/\S+/g) || []).length;
// export const esc = s =>
//   String(s ?? '').replace(
//     /[&<>"']/g,
//     c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
//   );
// export function upperRatio(s) {
//   const L = s.replace(/[^A-Za-z]/g, '');
//   if (L.length < 4) return 0;
//   return L.replace(/[^A-Z]/g, '').length / L.length;
// }
// export function titleCase(s) {
//   return s.toLowerCase().replace(/(^|[\s(“"'-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
// }
// export function toast(msg, ms = 4200) {
//   const t = $('toast');
//   t.textContent = msg;
//   t.hidden = false;
//   clearTimeout(toast._t);
//   toast._t = setTimeout(() => (t.hidden = true), ms);
// }
// export function lsGet(k, d) {
//   try {
//     const v = localStorage.getItem(k);
//     return v ? JSON.parse(v) : d;
//   } catch (e) {
//     return d;
//   }
// }
// export function lsSet(k, v) {
//   try {
//     localStorage.setItem(k, JSON.stringify(v));
//   } catch (e) {}
// }
// export const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// export const pad = n => String(n).padStart(2, '0');
// export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// export function fmtMins(secs) {
//   const m = Math.round(secs / 60);
//   if (m < 60) return m + ' min';
//   const h = Math.floor(m / 60);
//   return h + ' h ' + (m % 60) + ' min';
// }
// export function fmtNum(n) {
//   return n >= 10000 ? Math.round(n / 1000) + 'k' : n.toLocaleString();
// }
// export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// export const prefs = Object.assign(
//   { fs: 19, handAll: false, motion: !reduceMotion, sound: false, vol: 45, ui: 'system' },
//   lsGet('iw:prefs', {})
// );
// export const savePrefs = () => lsSet('iw:prefs', prefs);
// export function applyUiTheme() {
//   if (prefs.ui === 'system') document.documentElement.removeAttribute('data-theme');
//   else document.documentElement.setAttribute('data-theme', prefs.ui);
// }
// applyUiTheme();

// Generic helpers and user preferences.
/* ============================== Small utils ============================== */
export const $ = id => document.getElementById(id);
export const R = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const words = s => (s.match(/\S+/g) || []).length;
export const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
export function upperRatio(s) {
  const L = s.replace(/[^A-Za-z]/g, '');
  if (L.length < 4) return 0;
  return L.replace(/[^A-Z]/g, '').length / L.length;
}
export function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s(“"'-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
}
export function toast(msg, ms = 4200) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms);
}
export function lsGet(k, d) {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : d;
  } catch (e) {
    return d;
  }
}
export function lsSet(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
}
export const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const pad = n => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function fmtMins(secs) {
  const m = Math.round(secs / 60);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  return h + ' h ' + (m % 60) + ' min';
}
export function fmtNum(n) {
  return n >= 10000 ? Math.round(n / 1000) + 'k' : n.toLocaleString();
}
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const prefs = Object.assign(
  { fs: 19, handAll: false, motion: !reduceMotion, sound: false, vol: 45, ui: 'system', pageOpacity: null, pageOpacitySet: false },
  lsGet('iw:prefs', {})
);
export const savePrefs = () => lsSet('iw:prefs', prefs);
export function applyUiTheme() {
  if (prefs.ui === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', prefs.ui);
}
applyUiTheme();
