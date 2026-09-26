// IndexedDB cache for downloaded book text.
// Small IndexedDB wrapper. Used only as a cache of downloaded book text,
// so reopening a book costs no bandwidth. The source of truth is Supabase.
const mem = new Map();
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise(res => {
    try {
      const r = indexedDB.open('inkworlds-cache', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('content')) d.createObjectStore('content', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch (e) {
      res(null);
    }
  });
  return dbp;
}
function tx(mode, fn) {
  return open().then(d => {
    if (!d) {
      const r = fn(null);
      return r && typeof r === 'object' && 'result' in r ? r.result : r;
    }
    return new Promise((res, rej) => {
      const t = d.transaction('content', mode),
        s = t.objectStore('content'),
        req = fn(s);
      t.oncomplete = () => res(req && 'result' in req ? req.result : undefined);
      t.onerror = () => rej(t.error);
    });
  });
}
export const Cache = {
  get: id => tx('readonly', s => (s ? s.get(id) : { result: mem.get(id) })).catch(() => mem.get(id)),
  put: v =>
    tx('readwrite', s => {
      if (!s) {
        mem.set(v.id, v);
        return null;
      }
      return s.put(v);
    }).catch(() => mem.set(v.id, v)),
  del: id =>
    tx('readwrite', s => {
      if (!s) {
        mem.delete(id);
        return null;
      }
      return s.delete(id);
    }).catch(() => {}),
  clear: () =>
    tx('readwrite', s => {
      if (!s) {
        mem.clear();
        return null;
      }
      return s.clear();
    }).catch(() => {})
};
