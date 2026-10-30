// Minimal browser-side EPUB parser. EPUB is a ZIP containing XHTML chapters and an OPF spine.

const textDecoder = new TextDecoder('utf-8');

function u16(view, at) { return view.getUint16(at, true); }
function u32(view, at) { return view.getUint32(at, true); }

function normalizePath(path) {
  const parts = String(path || '').split('/');
  const out = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}

function dirname(path) {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i + 1);
}

function resolvePath(base, href) {
  if (/^[a-z]+:/i.test(href)) return href;
  return normalizePath(dirname(base) + href.split('#')[0]);
}

function decode(bytes) {
  return textDecoder.decode(bytes);
}

async function inflateRaw(bytes) {
  if (!('DecompressionStream' in window)) {
    throw new Error('This browser cannot unpack EPUB files. Please update Inkworlds or your browser.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function findEndOfCentralDirectory(view) {
  const start = Math.max(0, view.byteLength - 0xffff - 22);
  for (let i = view.byteLength - 22; i >= start; i--) {
    if (u32(view, i) === 0x06054b50) return i;
  }
  return -1;
}

async function readZip(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) throw new Error('This file is not a valid EPUB/ZIP archive.');

  const count = u16(view, eocd + 10);
  const centralSize = u32(view, eocd + 12);
  const centralOffset = u32(view, eocd + 16);
  const entries = new Map();
  let at = centralOffset;

  for (let i = 0; i < count; i++) {
    if (u32(view, at) !== 0x02014b50) throw new Error('The EPUB directory is damaged.');
    const method = u16(view, at + 10);
    const compressedSize = u32(view, at + 20);
    const nameLen = u16(view, at + 28);
    const extraLen = u16(view, at + 30);
    const commentLen = u16(view, at + 32);
    const localOffset = u32(view, at + 42);
    const name = decode(bytes.subarray(at + 46, at + 46 + nameLen));
    entries.set(name.replace(/\\/g, '/'), { method, compressedSize, localOffset });
    at += 46 + nameLen + extraLen + commentLen;
  }

  if (!entries.size || centralOffset + centralSize > bytes.length) {
    throw new Error('The EPUB archive is incomplete.');
  }

  return {
    async get(name) {
      const entry = entries.get(name) || entries.get(normalizePath(name));
      if (!entry) return null;
      const off = entry.localOffset;
      if (u32(view, off) !== 0x04034b50) throw new Error('The EPUB entry is damaged.');
      const nameLen = u16(view, off + 26);
      const extraLen = u16(view, off + 28);
      const start = off + 30 + nameLen + extraLen;
      const compressed = bytes.subarray(start, start + entry.compressedSize);
      if (entry.method === 0) return compressed.slice();
      if (entry.method === 8) return inflateRaw(compressed);
      throw new Error(`Unsupported EPUB compression method: ${entry.method}`);
    },
    names() { return [...entries.keys()]; }
  };
}

function directText(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function xhtmlBlocks(doc) {
  const body = doc.body || doc.documentElement;
  const nodes = [...body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre')];
  const paras = nodes.map(directText).filter(Boolean);
  if (paras.length) return paras;
  const text = directText(body);
  return text ? [text] : [];
}

function titleFromDoc(doc, fallback) {
  const heading = doc.querySelector('h1,h2,h3,h4,h5,h6');
  return directText(heading) || fallback;
}

function metadataText(doc, selector) {
  return directText(doc.querySelector(selector));
}

export async function extractEpub(file, onProgress = () => {}) {
  let zip;
  try {
    zip = await readZip(file);
  } catch (e) {
    throw new Error(e?.message || 'This EPUB could not be opened.');
  }

  onProgress(0.08, 'Reading EPUB package…');
  const containerBytes = await zip.get('META-INF/container.xml');
  if (!containerBytes) throw new Error('This EPUB is missing META-INF/container.xml.');
  const container = new DOMParser().parseFromString(decode(containerBytes), 'application/xml');
  const rootfile = container.querySelector('rootfile[full-path]')?.getAttribute('full-path');
  if (!rootfile) throw new Error('This EPUB has no readable package document.');

  const opfBytes = await zip.get(rootfile);
  if (!opfBytes) throw new Error('The EPUB package document could not be read.');
  const opf = new DOMParser().parseFromString(decode(opfBytes), 'application/xml');
  const manifest = new Map();
  opf.querySelectorAll('manifest > item').forEach(item => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) manifest.set(id, {
      href: resolvePath(rootfile, href),
      mediaType: item.getAttribute('media-type') || '',
      properties: item.getAttribute('properties') || ''
    });
  });

  const title = metadataText(opf, 'metadata > title') || metadataText(opf, 'dc\\:title') || '';
  const author = metadataText(opf, 'metadata > creator') || metadataText(opf, 'dc\\:creator') || '';
  const spine = [...opf.querySelectorAll('spine > itemref')]
    .map(x => manifest.get(x.getAttribute('idref')))
    .filter(Boolean)
    .filter(x => /^application\/xhtml\+xml$|^text\/html$/i.test(x.mediaType));

  if (!spine.length) throw new Error('This EPUB has no readable chapters.');

  const chapters = [];
  for (let i = 0; i < spine.length; i++) {
    const item = spine[i];
    const bytes = await zip.get(item.href);
    if (!bytes) continue;
    const doc = new DOMParser().parseFromString(decode(bytes), 'text/html');
    const paras = xhtmlBlocks(doc);
    if (!paras.length) continue;
    chapters.push({
      title: titleFromDoc(doc, `Chapter ${chapters.length + 1}`),
      paras
    });
    onProgress(0.1 + ((i + 1) / spine.length) * 0.78, `Reading chapter ${i + 1} of ${spine.length}…`);
  }

  if (!chapters.length) throw new Error('This EPUB contains no readable text.');

  let cover = null;
  let coverItem = [...manifest.values()].find(x => /cover-image/i.test(x.properties));
  if (!coverItem) {
    const coverMeta = opf.querySelector('metadata meta[name="cover"]');
    if (coverMeta) coverItem = manifest.get(coverMeta.getAttribute('content')) || null;
  }
  if (!coverItem) {
    coverItem = [...manifest.values()].find(x => /^image\//i.test(x.mediaType) && /cover/i.test(x.href));
  }
  if (coverItem) {
    const bytes = await zip.get(coverItem.href);
    if (bytes) cover = new Blob([bytes], { type: coverItem.mediaType || 'image/jpeg' });
  }

  onProgress(1, 'EPUB ready.');
  return { title, author, chapters, cover };
}
