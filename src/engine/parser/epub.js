// Minimal browser-side EPUB parser. EPUB is a ZIP containing XHTML chapters and an OPF spine.

const textDecoder = new TextDecoder('utf-8');

function u16(view, at) { return view.getUint16(at, true); }
function u32(view, at) { return view.getUint32(at, true); }

function normalizePath(path) {
  const parts = String(path || '').replace(/\\/g, '/').split('/');
  const out = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}

function dirname(path) {
  const norm = normalizePath(path);
  const i = norm.lastIndexOf('/');
  return i < 0 ? '' : norm.slice(0, i + 1);
}

function resolvePath(base, href) {
  if (!href) return '';
  if (/^[a-z]+:/i.test(href)) return href;
  const cleanHref = href.split('#')[0];
  const combined = dirname(base) + cleanHref;
  return normalizePath(combined);
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
    const rawName = decode(bytes.subarray(at + 46, at + 46 + nameLen));
    const name = rawName.replace(/\\/g, '/');
    const entry = { method, compressedSize, localOffset };
    entries.set(name, entry);
    const norm = normalizePath(name);
    if (!entries.has(norm)) entries.set(norm, entry);
    try {
      const decoded = decodeURIComponent(name);
      if (!entries.has(decoded)) entries.set(decoded, entry);
      const decodedNorm = normalizePath(decoded);
      if (!entries.has(decodedNorm)) entries.set(decodedNorm, entry);
    } catch {}
    at += 46 + nameLen + extraLen + commentLen;
  }

  if (!entries.size || centralOffset + centralSize > bytes.length) {
    throw new Error('The EPUB archive is incomplete.');
  }

  return {
    async get(name) {
      if (!name) return null;
      let entry = entries.get(name) || entries.get(normalizePath(name));
      if (!entry) {
        try {
          const dec = decodeURIComponent(name);
          entry = entries.get(dec) || entries.get(normalizePath(dec));
        } catch {}
      }
      if (!entry) {
        const target = normalizePath(name).toLowerCase();
        for (const [k, v] of entries.entries()) {
          if (normalizePath(k).toLowerCase() === target) {
            entry = v;
            break;
          }
        }
      }
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

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n\s+/g, '\n')
    .replace(/\s+\n/g, '\n')
    .trim();
}

function extractElementText(el) {
  if (!el) return '';
  const clone = el.cloneNode(true);
  clone.querySelectorAll('br, hr').forEach(b => b.replaceWith('\n'));
  clone.querySelectorAll('script, style, noscript').forEach(s => s.remove());
  return cleanText(clone.textContent);
}

function isLeafBlock(el) {
  const tag = el.tagName.toUpperCase();
  if (tag === 'P' || tag === 'PRE' || tag === 'DT' || tag === 'DD' || /^H[1-6]$/.test(tag)) {
    return true;
  }
  if (tag === 'LI' || tag === 'BLOCKQUOTE' || tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE') {
    const hasChildBlock = el.querySelector('p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, dt, dd, div');
    return !hasChildBlock;
  }
  return false;
}

function getLeafBlockNodes(root, excludeSet = new Set()) {
  const nodes = [];

  function walk(node) {
    if (!node || node.nodeType !== 1) return;
    if (excludeSet.has(node)) return;

    const tag = node.tagName.toUpperCase();
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'NAV') {
      return;
    }

    if (isLeafBlock(node)) {
      nodes.push(node);
      return;
    }

    for (let child = node.firstElementChild; child; child = child.nextElementSibling) {
      walk(child);
    }
  }

  walk(root);
  return nodes;
}

function splitTitleAndSub(fullTitle) {
  const t = cleanText(fullTitle);
  if (!t) return { title: '', sub: '' };

  // E.g., "Chapter 1: The Boy Who Lived" or "CHAPTER I — The Beginning"
  const m = t.match(/^((?:Chapter|Book|Part|Section|Volume|Act|Scene|Prologue|Epilogue)\s*[\w\dIVXLC]+)\s*[:—–-]\s*(.+)$/i);
  if (m) {
    return { title: cleanText(m[1]), sub: cleanText(m[2]) };
  }

  return { title: t, sub: '' };
}

function getXmlText(xmlDoc, localName) {
  if (xmlDoc.getElementsByTagNameNS) {
    const list = xmlDoc.getElementsByTagNameNS('*', localName);
    for (let i = 0; i < list.length; i++) {
      const t = cleanText(list[i].textContent);
      if (t) return t;
    }
  }
  const list = xmlDoc.getElementsByTagName(localName);
  for (let i = 0; i < list.length; i++) {
    const t = cleanText(list[i].textContent);
    if (t) return t;
  }
  const dcList = xmlDoc.getElementsByTagName(`dc:${localName}`);
  for (let i = 0; i < dcList.length; i++) {
    const t = cleanText(dcList[i].textContent);
    if (t) return t;
  }
  return '';
}

async function parseToc(zip, opf, manifest) {
  const tocEntries = [];

  // 1. Try EPUB 3 Navigation Document
  const navItem = [...manifest.values()].find(x => /\bnav\b/i.test(x.properties));
  if (navItem) {
    const bytes = await zip.get(navItem.href);
    if (bytes) {
      const doc = new DOMParser().parseFromString(decode(bytes), 'text/html');
      const navEl = doc.querySelector('nav[*|type="toc"], nav[epub\\:type="toc"], nav#toc, nav.toc') || doc.querySelector('nav');
      if (navEl) {
        const links = navEl.querySelectorAll('a[href]');
        links.forEach(a => {
          const rawHref = a.getAttribute('href');
          if (!rawHref) return;
          const [filePath, anchor] = rawHref.split('#');
          const fileHref = resolvePath(navItem.href, filePath);
          const title = cleanText(a.textContent);
          if (title) {
            tocEntries.push({ title, fileHref, anchor: anchor || '' });
          }
        });
      }
    }
  }

  // 2. Fallback to EPUB 2 NCX
  if (!tocEntries.length) {
    let ncxHref = null;
    const spine = opf.querySelector('spine');
    const tocId = spine?.getAttribute('toc');
    if (tocId && manifest.has(tocId)) {
      ncxHref = manifest.get(tocId).href;
    }
    if (!ncxHref) {
      const ncxItem = [...manifest.values()].find(x =>
        /application\/x-dtbncx\+xml/i.test(x.mediaType) || /\.ncx$/i.test(x.href)
      );
      if (ncxItem) ncxHref = ncxItem.href;
    }

    if (ncxHref) {
      const bytes = await zip.get(ncxHref);
      if (bytes) {
        const doc = new DOMParser().parseFromString(decode(bytes), 'application/xml');
        const navPoints = doc.querySelectorAll('navPoint');
        navPoints.forEach(np => {
          const textEl = np.querySelector('navLabel > text');
          const contentEl = np.querySelector('content');
          const rawSrc = contentEl?.getAttribute('src');
          if (!rawSrc) return;
          const [filePath, anchor] = rawSrc.split('#');
          const fileHref = resolvePath(ncxHref, filePath);
          const title = cleanText(textEl?.textContent);
          if (title) {
            tocEntries.push({ title, fileHref, anchor: anchor || '' });
          }
        });
      }
    }
  }

  // Deduplicate consecutive identical entries
  const unique = [];
  for (const entry of tocEntries) {
    const prev = unique[unique.length - 1];
    if (!prev || prev.title !== entry.title || prev.fileHref !== entry.fileHref || prev.anchor !== entry.anchor) {
      unique.push(entry);
    }
  }

  return unique;
}

function isCoverOrNavPage(doc, wordCount, hasTocProperty) {
  if (hasTocProperty) return true;
  const body = doc.body || doc.documentElement;
  const imgCount = body.querySelectorAll('img, svg, image').length;

  // Pure cover image page
  if (imgCount > 0 && wordCount < 20) return true;

  // Standalone Table of Contents page
  const title = (doc.querySelector('h1, h2, title')?.textContent || '').toLowerCase();
  const aCount = body.querySelectorAll('a[href]').length;
  if (/^(table of contents|contents|toc)$/i.test(title.trim()) && aCount > 3) {
    return true;
  }

  return false;
}

function findAnchorElement(doc, anchor) {
  if (!anchor) return null;
  const el = doc.getElementById(anchor);
  if (el) return el;
  try {
    const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(anchor) : anchor.replace(/["\\]/g, '\\$&');
    return doc.querySelector(`[name="${esc}"], [id="${esc}"]`);
  } catch {
    return null;
  }
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
    if (id && href) {
      manifest.set(id, {
        id,
        href: resolvePath(rootfile, href),
        mediaType: item.getAttribute('media-type') || '',
        properties: item.getAttribute('properties') || ''
      });
    }
  });

  const title = getXmlText(opf, 'title') || file.name.replace(/\.epub$/i, '');
  const author = getXmlText(opf, 'creator') || '';

  // Parse guide for cover and toc references
  const guideCover = resolvePath(rootfile, opf.querySelector('guide > reference[type="cover"]')?.getAttribute('href') || '');
  const guideToc = resolvePath(rootfile, opf.querySelector('guide > reference[type="toc"]')?.getAttribute('href') || '');

  onProgress(0.12, 'Reading Table of Contents…');
  const tocEntries = await parseToc(zip, opf, manifest);
  const tocByFile = new Map();
  for (const entry of tocEntries) {
    if (!tocByFile.has(entry.fileHref)) tocByFile.set(entry.fileHref, []);
    tocByFile.get(entry.fileHref).push(entry);
  }

  // Parse spine
  const spineItemRefs = [...opf.querySelectorAll('spine > itemref')];
  const spine = spineItemRefs
    .map(ref => {
      const item = manifest.get(ref.getAttribute('idref'));
      if (!item) return null;
      return {
        ...item,
        linear: ref.getAttribute('linear') !== 'no'
      };
    })
    .filter(Boolean)
    .filter(x => /^application\/xhtml\+xml$|^text\/html$/i.test(x.mediaType));

  if (!spine.length) throw new Error('This EPUB has no readable chapters.');

  const chapters = [];

  for (let i = 0; i < spine.length; i++) {
    const item = spine[i];
    const isNav = /\bnav\b/i.test(item.properties) || item.href === guideToc;

    const bytes = await zip.get(item.href);
    if (!bytes) continue;

    const doc = new DOMParser().parseFromString(decode(bytes), 'text/html');
    const body = doc.body || doc.documentElement;

    const fileEntries = tocByFile.get(item.href) || [];

    // Check if this whole file is cover or nav page
    const totalRawText = cleanText(body.textContent);
    const wordCount = (totalRawText.match(/\S+/g) || []).length;

    if (isNav || item.href === guideCover || (!item.linear && wordCount < 50)) {
      if (isCoverOrNavPage(doc, wordCount, isNav || item.href === guideCover)) {
        continue;
      }
    }

    if (isCoverOrNavPage(doc, wordCount, false)) {
      continue;
    }

    // Case 1: Multiple TOC entries point to this file (subsections / chapters split by anchors)
    if (fileEntries.length > 1) {
      const anchorPoints = fileEntries.map(entry => ({
        entry,
        el: findAnchorElement(doc, entry.anchor)
      }));

      const validAnchors = anchorPoints.filter(ap => ap.el !== null);

      if (validAnchors.length > 1) {
        // Collect all leaf block nodes
        const allLeafNodes = getLeafBlockNodes(body);

        for (let aIdx = 0; aIdx < validAnchors.length; aIdx++) {
          const currentAnchor = validAnchors[aIdx];
          const nextAnchor = validAnchors[aIdx + 1];

          const chapterNodes = allLeafNodes.filter(node => {
            // Must not be before current anchor
            if (node === currentAnchor.el) return true;
            const posToCurrent = currentAnchor.el.compareDocumentPosition(node);
            const isAfterCurrent = (posToCurrent & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 || currentAnchor.el.contains(node);
            if (!isAfterCurrent) return false;

            // Must be before next anchor if there is one
            if (nextAnchor) {
              if (node === nextAnchor.el) return false;
              const posToNext = nextAnchor.el.compareDocumentPosition(node);
              const isBeforeNext = (posToNext & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
              return isBeforeNext;
            }

            return true;
          });

          // Check if the first node is a heading identical to title
          const { title: chTitle, sub: chSub } = splitTitleAndSub(currentAnchor.entry.title);
          const paras = [];
          for (let nIdx = 0; nIdx < chapterNodes.length; nIdx++) {
            const node = chapterNodes[nIdx];
            const text = extractElementText(node);
            if (!text) continue;

            // Avoid repeating the chapter title if the node is a heading or anchor element
            if (nIdx === 0 && /^H[1-6]$/i.test(node.tagName)) {
              if (text.toLowerCase() === chTitle.toLowerCase() || text.toLowerCase() === currentAnchor.entry.title.toLowerCase()) {
                continue;
              }
            }
            paras.push(text);
          }

          if (paras.length) {
            chapters.push({
              title: chTitle || `Chapter ${chapters.length + 1}`,
              sub: chSub || '',
              paras
            });
          }
        }

        onProgress(0.12 + ((i + 1) / spine.length) * 0.76, `Reading chapter ${chapters.length}…`);
        continue;
      }
    }

    // Case 2: Exactly one TOC entry points to this file
    if (fileEntries.length === 1) {
      const entry = fileEntries[0];
      const { title: chTitle, sub: chSub } = splitTitleAndSub(entry.title);

      // Identify heading element to exclude from paras so it is not displayed twice
      const heading = doc.querySelector('h1, h2, h3, .chapter-title, .title');
      const excludeSet = new Set();
      if (heading) {
        const hText = cleanText(heading.textContent).toLowerCase();
        if (hText === chTitle.toLowerCase() || hText === entry.title.toLowerCase() || /^(chapter|part|book)\b/i.test(hText)) {
          excludeSet.add(heading);
        }
      }

      const leafNodes = getLeafBlockNodes(body, excludeSet);
      const paras = leafNodes.map(extractElementText).filter(Boolean);

      if (paras.length) {
        chapters.push({
          title: chTitle || `Chapter ${chapters.length + 1}`,
          sub: chSub || '',
          paras
        });
      }

      onProgress(0.12 + ((i + 1) / spine.length) * 0.76, `Reading chapter ${chapters.length}…`);
      continue;
    }

    // Case 3: No TOC entry for this file
    // Check if the file has multiple prominent chapter headings (e.g. single-file EPUB)
    const majorHeadings = [...doc.querySelectorAll('h1, h2.chapter, h2.chapter-title')].filter(h => {
      const t = cleanText(h.textContent);
      return /^(chapter|book|part|prologue|epilogue|act)\b/i.test(t) || /^([IVXLC]{1,7}|\d{1,3})\.?$/.test(t);
    });

    if (majorHeadings.length > 1 && wordCount > 1500) {
      const allLeafNodes = getLeafBlockNodes(body);

      for (let hIdx = 0; hIdx < majorHeadings.length; hIdx++) {
        const currentH = majorHeadings[hIdx];
        const nextH = majorHeadings[hIdx + 1];

        const chapterNodes = allLeafNodes.filter(node => {
          if (node === currentH) return false; // Exclude the heading itself from paras
          const posToCurrent = currentH.compareDocumentPosition(node);
          const isAfter = (posToCurrent & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
          if (!isAfter) return false;

          if (nextH) {
            if (node === nextH) return false;
            const posToNext = nextH.compareDocumentPosition(node);
            const isBefore = (posToNext & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
            return isBefore;
          }

          return true;
        });

        const paras = chapterNodes.map(extractElementText).filter(Boolean);
        if (paras.length) {
          const { title: chTitle, sub: chSub } = splitTitleAndSub(cleanText(currentH.textContent));
          chapters.push({
            title: chTitle || `Chapter ${chapters.length + 1}`,
            sub: chSub || '',
            paras
          });
        }
      }

      onProgress(0.12 + ((i + 1) / spine.length) * 0.76, `Reading chapter ${chapters.length}…`);
      continue;
    }

    // Single chapter without TOC entry
    // Extract title from heading or head title
    let detectedTitle = '';
    let detectedSub = '';
    const excludeSet = new Set();

    const h1 = doc.querySelector('h1');
    const h2 = doc.querySelector('h2');
    const titleEl = doc.querySelector('.chapter-title, .title, .heading');

    if (h1) {
      excludeSet.add(h1);
      const h1Text = cleanText(h1.textContent);
      // Check if h2 immediately follows as subtitle
      if (h2 && (h1.nextElementSibling === h2 || h1.parentElement?.contains(h2))) {
        excludeSet.add(h2);
        detectedTitle = h1Text;
        detectedSub = cleanText(h2.textContent);
      } else {
        const parts = splitTitleAndSub(h1Text);
        detectedTitle = parts.title;
        detectedSub = parts.sub;
      }
    } else if (h2) {
      excludeSet.add(h2);
      const parts = splitTitleAndSub(cleanText(h2.textContent));
      detectedTitle = parts.title;
      detectedSub = parts.sub;
    } else if (titleEl) {
      excludeSet.add(titleEl);
      const parts = splitTitleAndSub(cleanText(titleEl.textContent));
      detectedTitle = parts.title;
      detectedSub = parts.sub;
    } else {
      const headTitle = cleanText(doc.querySelector('head > title')?.textContent);
      if (headTitle && headTitle.toLowerCase() !== title.toLowerCase() && !/\.x?html?$/i.test(headTitle)) {
        detectedTitle = headTitle;
      }
    }

    const leafNodes = getLeafBlockNodes(body, excludeSet);
    let paras = leafNodes.map(extractElementText).filter(Boolean);

    // Fallback: If no leaf blocks found, try splitting body text by double newline
    if (!paras.length) {
      const text = extractElementText(body);
      if (text) {
        paras = text.split(/\n\s*\n+/).map(cleanText).filter(Boolean);
      }
    }

    if (paras.length) {
      chapters.push({
        title: detectedTitle || `Chapter ${chapters.length + 1}`,
        sub: detectedSub || '',
        paras
      });
    }

    onProgress(0.12 + ((i + 1) / spine.length) * 0.76, `Reading chapter ${chapters.length}…`);
  }

  if (!chapters.length) {
    // Resilient fallback: parse every spine item directly without any filtering
    for (let i = 0; i < spine.length; i++) {
      const item = spine[i];
      const bytes = await zip.get(item.href);
      if (!bytes) continue;
      const doc = new DOMParser().parseFromString(decode(bytes), 'text/html');
      const body = doc.body || doc.documentElement;
      const leafNodes = getLeafBlockNodes(body);
      const paras = leafNodes.map(extractElementText).filter(Boolean);
      if (paras.length) {
        chapters.push({
          title: `Section ${chapters.length + 1}`,
          sub: '',
          paras
        });
      }
    }
  }

  if (!chapters.length) throw new Error('This EPUB contains no readable text.');

  // Extract cover image
  let cover = null;
  let coverItem = [...manifest.values()].find(x => /\bcover-image\b/i.test(x.properties) || /\bcover\b/i.test(x.properties));

  if (!coverItem) {
    const coverMeta = opf.querySelector('metadata meta[name="cover"]');
    if (coverMeta) coverItem = manifest.get(coverMeta.getAttribute('content')) || null;
  }
  if (!coverItem && guideCover) {
    coverItem = [...manifest.values()].find(x => x.href === guideCover) || null;
  }
  if (!coverItem) {
    coverItem = [...manifest.values()].find(x => /^image\//i.test(x.mediaType) && /cover/i.test(x.href));
  }
  if (!coverItem) {
    coverItem = [...manifest.values()].find(x => /^image\//i.test(x.mediaType) && /cover|jacket|title/i.test(x.id));
  }

  if (coverItem) {
    const bytes = await zip.get(coverItem.href);
    if (bytes) {
      cover = new Blob([bytes], { type: coverItem.mediaType || 'image/jpeg' });
    }
  }

  onProgress(1, 'EPUB ready.');
  return { title, author, chapters, cover };
}
