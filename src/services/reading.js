// Progress, highlights, bookmarks and reading stats.
import { must, sb } from './client.js';
import { myId } from './session.js';

export async function getProgress(bookId) {
  if (!myId()) return null;
  const r = must(
    await sb().from('progress').select('*').eq('user_id', myId()).eq('book_id', bookId).maybeSingle()
  );
  return (
    r && { ch: r.ch, frac: r.frac, pct: r.pct, maxPct: r.max_pct, updated: new Date(r.updated_at).getTime() }
  );
}

export async function allProgress() {
  if (!myId()) return [];
  return must(
    await sb().from('progress').select('book_id,ch,frac,pct,max_pct,updated_at').eq('user_id', myId())
  ).map(r => ({
    bookId: r.book_id,
    ch: r.ch,
    frac: r.frac,
    pct: r.pct,
    maxPct: r.max_pct,
    updated: new Date(r.updated_at).getTime()
  }));
}

export async function saveProgress(bookId, p) {
  if (!myId()) return;
  must(
    await sb()
      .from('progress')
      .upsert({
        user_id: myId(),
        book_id: bookId,
        ch: p.ch,
        frac: p.frac,
        pct: p.pct,
        max_pct: p.maxPct || p.pct,
        updated_at: new Date(p.updated || Date.now()).toISOString()
      })
  );
}

export const hlRow = r => ({
  id: r.id,
  bookId: r.book_id,
  ch: r.ch,
  si: r.si,
  start: r.start_off,
  end: r.end_off,
  text: r.text,
  note: r.note,
  chTitle: r.ch_title,
  created: new Date(r.created_at).getTime()
});

export async function highlights(bookId) {
  if (!myId()) return [];
  let q = sb().from('highlights').select('*').eq('user_id', myId()).order('created_at', { ascending: false });
  if (bookId) q = q.eq('book_id', bookId);
  return must(await q).map(hlRow);
}

export async function addHighlight(h) {
  return hlRow(
    must(
      await sb()
        .from('highlights')
        .insert({
          user_id: myId(),
          book_id: h.bookId,
          ch: h.ch,
          si: h.si,
          start_off: h.start,
          end_off: h.end,
          text: h.text.slice(0, 4000),
          note: (h.note || '').slice(0, 2000),
          ch_title: h.chTitle || ''
        })
        .select('*')
        .single()
    )
  );
}

export async function updateHighlight(id, note) {
  must(
    await sb()
      .from('highlights')
      .update({ note: note.slice(0, 2000) })
      .eq('id', id)
  );
}

export async function deleteHighlight(id) {
  must(await sb().from('highlights').delete().eq('id', id));
}

export const bmRow = r => ({
  id: r.id,
  bookId: r.book_id,
  ch: r.ch,
  si: r.si,
  snippet: r.snippet,
  created: new Date(r.created_at).getTime()
});

export async function bookmarks(bookId) {
  if (!myId()) return [];
  return must(await sb().from('bookmarks').select('*').eq('user_id', myId()).eq('book_id', bookId)).map(
    bmRow
  );
}

export async function addBookmark(b) {
  return bmRow(
    must(
      await sb()
        .from('bookmarks')
        .insert({ user_id: myId(), book_id: b.bookId, ch: b.ch, si: b.si, snippet: b.snippet })
        .select('*')
        .single()
    )
  );
}

export async function deleteBookmark(id) {
  must(await sb().from('bookmarks').delete().eq('id', id));
}

export async function addReading(day, secs, words, bookId, world) {
  if (!myId()) return;
  must(
    await sb().rpc('add_reading', {
      p_day: day,
      p_secs: Math.round(secs),
      p_words: Math.round(words),
      p_book: bookId || null,
      p_world: world || null
    })
  );
}

export async function readingDays() {
  if (!myId()) return [];
  return must(
    await sb()
      .from('reading_days')
      .select('day,secs,words,books,worlds')
      .eq('user_id', myId())
      .order('day', { ascending: false })
      .limit(400)
  );
}
