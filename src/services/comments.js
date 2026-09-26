// Comments, likes and realtime updates.
import { must, sb } from './client.js';
import { myId } from './session.js';
import { supabase } from './supabase.js';

export async function comments({ bookId, postId, type, ch, si }) {
  let q = sb().from('comments').select('*').order('created_at', { ascending: true }).limit(500);
  if (postId) q = q.eq('post_id', postId);
  else q = q.eq('book_id', bookId).eq('target_type', type);
  if (ch != null) q = q.eq('ch', ch);
  if (si != null) q = q.eq('si', si);
  return must(await q);
}

export async function passageCounts(bookId) {
  return must(
    await sb().from('comments').select('id,ch,si').eq('book_id', bookId).eq('target_type', 'para').limit(5000)
  );
}

export async function addComment(c) {
  return must(
    await sb()
      .from('comments')
      .insert({
        author_id: myId(),
        target_type: c.type,
        book_id: c.bookId || null,
        post_id: c.postId || null,
        ch: c.ch ?? null,
        si: c.si ?? null,
        quote: (c.quote || '').slice(0, 300),
        body: c.body.slice(0, 2000),
        parent_id: c.parentId || null
      })
      .select('*')
      .single()
  );
}

export async function deleteComment(id) {
  must(await sb().from('comments').delete().eq('id', id));
}

export function watchComments(column, value, onInsert) {
  if (!supabase || !supabase.channel) return () => {};
  const ch = supabase
    .channel(`c-${column}-${value}-${Math.random().toString(36).slice(2, 7)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comments', filter: `${column}=eq.${value}` },
      p => onInsert(p.new)
    )
    .subscribe();
  return () => {
    try {
      supabase.removeChannel(ch);
    } catch (e) {}
  };
}

export async function liked(bookId) {
  if (!myId()) return false;
  return !!must(
    await sb().from('likes').select('book_id').eq('book_id', bookId).eq('user_id', myId()).maybeSingle()
  );
}

export async function setLike(bookId, on) {
  if (on) must(await sb().from('likes').insert({ book_id: bookId, user_id: myId() }));
  else must(await sb().from('likes').delete().eq('book_id', bookId).eq('user_id', myId()));
}
