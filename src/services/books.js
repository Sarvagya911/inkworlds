// // Books: metadata in Postgres, gzipped text in Storage.
// import { Cache } from '../lib/cache.js';
// import { lsGet } from '../lib/utils.js';
// import { must, sb } from './client.js';
// import { myId } from './session.js';

// export const BOOK_COLS =
//   'id,owner_id,title,author,theme,auto_theme,ai_reason,hits,words,chapter_count,text_path,visibility,description,is_sample,like_count,comment_count,created_at,updated_at,published_at';

// export function rowToMeta(r) {
//   const own = !!r.owner_id && r.owner_id === myId();
//   const eff = r.theme && r.theme !== 'auto' ? r.theme : r.auto_theme || 'parchment';
//   const t = s => (s ? new Date(s).getTime() : 0);
//   return {
//     id: r.id,
//     title: r.title,
//     author: r.author || '',
//     words: r.words || 0,
//     chapters: r.chapter_count || 0,
//     hits: r.hits || [],
//     auto: own ? r.auto_theme || 'parchment' : eff,
//     theme: own
//       ? r.theme || 'auto'
//       : lsGet((r.is_sample ? 'iw:sampletheme:' : 'iw:remotetheme:') + r.id, null) || 'auto',
//     aiReason: own ? r.ai_reason || '' : '',
//     visibility: r.visibility,
//     desc: r.description || '',
//     ownerId: r.owner_id,
//     textPath: r.text_path,
//     sample: !!r.is_sample,
//     remote: !own && !r.is_sample,
//     own,
//     likeCount: r.like_count || 0,
//     commentCount: r.comment_count || 0,
//     created: t(r.created_at),
//     added: t(r.created_at),
//     updated: t(r.updated_at),
//     published: t(r.published_at)
//   };
// }

// export async function myBooks() {
//   if (!myId()) return [];
//   return must(
//     await sb()
//       .from('books')
//       .select(BOOK_COLS)
//       .eq('owner_id', myId())
//       .order('created_at', { ascending: false })
//   ).map(rowToMeta);
// }

// export async function bookMeta(id) {
//   const r = must(await sb().from('books').select(BOOK_COLS).eq('id', id).maybeSingle());
//   return r ? rowToMeta(r) : null;
// }

// export const clean = q => q.replace(/[%,()*\\]/g, ' ').trim();

// export async function publicBooks({ q = '', world = '', page = 0, size = 24 } = {}) {
//   let query = sb()
//     .from('books')
//     .select(BOOK_COLS, { count: 'exact' })
//     .eq('visibility', 'public')
//     .order('published_at', { ascending: false, nullsFirst: false })
//     .range(page * size, page * size + size - 1);
//   const c = clean(q);
//   if (c) query = query.or(`title.ilike.%${c}%,author.ilike.%${c}%`);
//   if (world) query = query.or(`theme.eq.${world},and(theme.eq.auto,auto_theme.eq.${world})`);
//   const { data, error, count } = await query;
//   if (error) throw error;
//   return { items: data.map(rowToMeta), total: count || 0 };
// }

// export async function gzip(str) {
//   if (!('CompressionStream' in window))
//     return { blob: new Blob([str], { type: 'application/json' }), gz: false };
//   const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
//   return { blob: await new Response(stream).blob(), gz: true };
// }

// export async function gunzip(blob, gz) {
//   if (!gz) return blob.text();
//   return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
// }

// export async function createBook(info, chapters) {
//   const id = crypto.randomUUID();
//   const { blob, gz } = await gzip(JSON.stringify({ v: 1, chapters }));
//   const path = `${myId()}/${id}.json${gz ? '.gz' : ''}`;
//   must(
//     await sb()
//       .storage.from('book-texts')
//       .upload(path, blob, { contentType: gz ? 'application/gzip' : 'application/json', upsert: false })
//   );
//   try {
//     const row = must(
//       await sb()
//         .from('books')
//         .insert({
//           id,
//           owner_id: myId(),
//           title: info.title.slice(0, 200),
//           author: (info.author || '').slice(0, 120),
//           auto_theme: info.auto,
//           hits: info.hits || [],
//           words: info.words,
//           chapter_count: chapters.length,
//           text_path: path
//         })
//         .select(BOOK_COLS)
//         .single()
//     );
//     await Cache.put({ id, path, chapters });
//     return rowToMeta(row);
//   } catch (e) {
//     await sb().storage.from('book-texts').remove([path]);
//     throw e;
//   }
// }

// export async function bookText(meta) {
//   const hit = await Cache.get(meta.id);
//   if (hit && hit.path === meta.textPath) return hit.chapters;
//   const blob = must(await sb().storage.from('book-texts').download(meta.textPath));
//   const chapters = JSON.parse(await gunzip(blob, meta.textPath.endsWith('.gz'))).chapters;
//   Cache.put({ id: meta.id, path: meta.textPath, chapters });
//   return chapters;
// }

// export async function updateBook(id, patch) {
//   must(await sb().from('books').update(patch).eq('id', id));
// }

// export async function deleteBook(meta) {
//   must(await sb().from('books').delete().eq('id', meta.id));
//   if (meta.textPath) await sb().storage.from('book-texts').remove([meta.textPath]);
//   Cache.del(meta.id);
// }

// export async function bookCommunityIds(id) {
//   return must(await sb().from('book_communities').select('community_id').eq('book_id', id)).map(
//     r => r.community_id
//   );
// }

// export async function setBookCommunities(id, cids) {
//   const have = await bookCommunityIds(id);
//   const drop = have.filter(c => !cids.includes(c)),
//     add = cids.filter(c => !have.includes(c));
//   if (drop.length)
//     must(await sb().from('book_communities').delete().eq('book_id', id).in('community_id', drop));
//   if (add.length)
//     must(
//       await sb()
//         .from('book_communities')
//         .insert(add.map(c => ({ book_id: id, community_id: c })))
//     );
// }


// Books: metadata in Postgres, gzipped text or original manga PDF in Storage.

import { Cache } from '../lib/cache.js';
import { lsGet } from '../lib/utils.js';
import { must, sb } from './client.js';
import { myId } from './session.js';

export const CONTENT_TYPES = {
  BOOK: 'book',
  LIGHT_NOVEL: 'light_novel',
  MANGA: 'manga'
};

export function contentTypeLabel(type) {
  switch (type) {
    case CONTENT_TYPES.LIGHT_NOVEL:
      return 'Light Novel';
    case CONTENT_TYPES.MANGA:
      return 'Manga';
    default:
      return 'Novel';
  }
}

export const BOOK_COLS =
  'id,owner_id,title,author,content_type,theme,auto_theme,ai_reason,hits,words,chapter_count,text_path,cover_path,visibility,description,is_sample,like_count,comment_count,created_at,updated_at,published_at';

export function coverUrl(path) {
  if (!path) return '';

  try {
    return (
      sb()
        .storage
        .from('book-covers')
        .getPublicUrl(path)
        .data
        ?.publicUrl || ''
    );
  } catch (e) {
    return '';
  }
}

export function rowToMeta(r) {
  const own =
    !!r.owner_id &&
    r.owner_id === myId();

  const eff =
    r.theme && r.theme !== 'auto'
      ? r.theme
      : r.auto_theme || 'parchment';

  const t = s =>
    s ? new Date(s).getTime() : 0;

  return {
    id: r.id,
    title: r.title,
    author: r.author || '',

    contentType:
      r.content_type ||
      CONTENT_TYPES.BOOK,

    words: r.words || 0,
    chapters: r.chapter_count || 0,
    hits: r.hits || [],

    auto: own
      ? r.auto_theme || 'parchment'
      : eff,

    theme: own
      ? r.theme || 'auto'
      : lsGet(
          (r.is_sample
            ? 'iw:sampletheme:'
            : 'iw:remotetheme:') + r.id,
          null
        ) || 'auto',

    aiReason: own
      ? r.ai_reason || ''
      : '',

    visibility: r.visibility,
    desc: r.description || '',

    ownerId: r.owner_id,
    textPath: r.text_path,

    coverPath: r.cover_path || '',
    coverUrl: coverUrl(r.cover_path),

    sample: !!r.is_sample,
    remote: !own && !r.is_sample,
    own,

    likeCount: r.like_count || 0,
    commentCount: r.comment_count || 0,

    created: t(r.created_at),
    added: t(r.created_at),
    updated: t(r.updated_at),
    published: t(r.published_at)
  };
}

export async function myBooks() {
  if (!myId()) return [];

  return must(
    await sb()
      .from('books')
      .select(BOOK_COLS)
      .eq('owner_id', myId())
      .order('created_at', {
        ascending: false
      })
  ).map(rowToMeta);
}

export async function bookMeta(id) {
  const r = must(
    await sb()
      .from('books')
      .select(BOOK_COLS)
      .eq('id', id)
      .maybeSingle()
  );

  return r
    ? rowToMeta(r)
    : null;
}

export const clean = q =>
  q
    .replace(/[%,()*\\]/g, ' ')
    .trim();

export async function publicBooks({
  q = '',
  world = '',
  contentType = '',
  page = 0,
  size = 24
} = {}) {
  let query = sb()
    .from('books')
    .select(BOOK_COLS, {
      count: 'exact'
    })
    .eq('visibility', 'public')
    .order('published_at', {
      ascending: false,
      nullsFirst: false
    })
    .range(
      page * size,
      page * size + size - 1
    );

  const c = clean(q);

  if (c) {
    query = query.or(
      `title.ilike.%${c}%,author.ilike.%${c}%`
    );
  }

  if (world) {
    query = query.or(
      `theme.eq.${world},and(theme.eq.auto,auto_theme.eq.${world})`
    );
  }

  if (contentType) {
    query = query.eq(
      'content_type',
      contentType
    );
  }

  const {
    data,
    error,
    count
  } = await query;

  if (error) throw error;

  return {
    items: data.map(rowToMeta),
    total: count || 0
  };
}

export async function gzip(str) {
  if (!('CompressionStream' in window)) {
    return {
      blob: new Blob(
        [str],
        {
          type: 'application/json'
        }
      ),
      gz: false
    };
  }

  const stream = new Blob([str])
    .stream()
    .pipeThrough(
      new CompressionStream('gzip')
    );

  return {
    blob: await new Response(stream).blob(),
    gz: true
  };
}

export async function gunzip(blob, gz) {
  if (!gz) return blob.text();

  return new Response(
    blob
      .stream()
      .pipeThrough(
        new DecompressionStream('gzip')
      )
  ).text();
}

export async function createBook(
  info,
  chapters,
  coverBlob = null,
  sourceBlob = null
) {
  const id = crypto.randomUUID();

  const isManga =
    info.contentType === CONTENT_TYPES.MANGA;

  let path;
  let uploadBlob;
  let uploadContentType;

  if (isManga) {
    if (!sourceBlob) {
      throw new Error(
        'The original manga PDF was not available.'
      );
    }

    // Manga keeps the original PDF.
    path =
      `${myId()}/${id}.pdf`;

    uploadBlob = sourceBlob;
    uploadContentType = 'application/pdf';
  } else {
    const {
      blob,
      gz
    } = await gzip(
      JSON.stringify({
        v: 1,
        chapters
      })
    );

    path =
      `${myId()}/${id}.json${gz ? '.gz' : ''}`;

    uploadBlob = blob;

    uploadContentType =
      gz
        ? 'application/gzip'
        : 'application/json';
  }

  must(
    await sb()
      .storage
      .from('book-texts')
      .upload(
        path,
        uploadBlob,
        {
          contentType:
            uploadContentType,
          upsert: false
        }
      )
  );

  let coverPath = null;

  try {
    if (coverBlob) {
      coverPath =
        `${myId()}/${id}.jpg`;

      const {
        error: coverError
      } = await sb()
        .storage
        .from('book-covers')
        .upload(
          coverPath,
          coverBlob,
          {
            contentType:
              'image/jpeg',
            upsert: false
          }
        );

      if (coverError) {
        coverPath = null;
        throw coverError;
      }
    }

    const row = must(
      await sb()
        .from('books')
        .insert({
          id,
          owner_id: myId(),
          title:
            info.title.slice(
              0,
              200
            ),
          author: (
            info.author || ''
          ).slice(0, 120),

          content_type:
            info.contentType ||
            CONTENT_TYPES.BOOK,

          auto_theme:
            info.auto,

          hits:
            info.hits || [],

          words:
            info.words || 0,

          chapter_count:
            chapters.length,

          text_path:
            path,

          cover_path:
            coverPath
        })
        .select(BOOK_COLS)
        .single()
    );

    await Cache.put({
      id,
      path,
      chapters
    });

    return rowToMeta(row);

  } catch (e) {
    await sb()
      .storage
      .from('book-texts')
      .remove([path]);

    if (coverPath) {
      await sb()
        .storage
        .from('book-covers')
        .remove([
          coverPath
        ]);
    }

    throw e;
  }
}

export async function bookText(meta) {
  /*
   * Manga does not have extracted text.
   * The original PDF lives at textPath.
   *
   * Return lightweight page placeholders so the
   * existing reader navigation/progress system
   * still knows how many pages exist.
   */
  if (
    meta.contentType ===
    CONTENT_TYPES.MANGA
  ) {
    return Array.from(
      {
        length:
          meta.chapters || 0
      },
      (_, i) => ({
        title:
          `Page ${i + 1}`,
        paras: []
      })
    );
  }

  const hit =
    await Cache.get(meta.id);

  if (
    hit &&
    hit.path === meta.textPath
  ) {
    return hit.chapters;
  }

  const blob = must(
    await sb()
      .storage
      .from('book-texts')
      .download(
        meta.textPath
      )
  );

  const chapters =
    JSON.parse(
      await gunzip(
        blob,
        meta.textPath.endsWith('.gz')
      )
    ).chapters;

  Cache.put({
    id: meta.id,
    path: meta.textPath,
    chapters
  });

  return chapters;
}

export async function updateBook(
  id,
  patch
) {
  must(
    await sb()
      .from('books')
      .update(patch)
      .eq('id', id)
  );
}

export async function deleteBook(meta) {
  must(
    await sb()
      .from('books')
      .delete()
      .eq('id', meta.id)
  );

  if (meta.textPath) {
    await sb()
      .storage
      .from('book-texts')
      .remove([
        meta.textPath
      ]);
  }

  if (meta.coverPath) {
    await sb()
      .storage
      .from('book-covers')
      .remove([
        meta.coverPath
      ]);
  }

  Cache.del(meta.id);
}

export async function bookCommunityIds(id) {
  return must(
    await sb()
      .from('book_communities')
      .select('community_id')
      .eq('book_id', id)
  ).map(
    r => r.community_id
  );
}

export async function setBookCommunities(
  id,
  cids
) {
  const have =
    await bookCommunityIds(id);

  const drop =
    have.filter(
      c => !cids.includes(c)
    );

  const add =
    cids.filter(
      c => !have.includes(c)
    );

  if (drop.length) {
    must(
      await sb()
        .from('book_communities')
        .delete()
        .eq(
          'book_id',
          id
        )
        .in(
          'community_id',
          drop
        )
    );
  }

  if (add.length) {
    must(
      await sb()
        .from('book_communities')
        .insert(
          add.map(c => ({
            book_id: id,
            community_id: c
          }))
        )
    );
  }
}