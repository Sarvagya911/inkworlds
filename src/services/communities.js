// Communities, members and discussions.
import { BOOK_COLS, rowToMeta } from './books.js';
import { must, sb } from './client.js';
import { myId } from './session.js';

export async function communities() {
  return must(
    await sb().from('communities').select('*').order('created_at', { ascending: false }).limit(100)
  );
}

export async function community(id) {
  return must(await sb().from('communities').select('*').eq('id', id).maybeSingle());
}

export async function myCommunityIds() {
  if (!myId()) return [];
  return must(await sb().from('community_members').select('community_id').eq('user_id', myId())).map(
    r => r.community_id
  );
}

export async function createCommunity(c) {
  return must(
    await sb()
      .from('communities')
      .insert({ name: c.name, description: c.desc, theme: c.theme, owner_id: myId() })
      .select('*')
      .single()
  );
}

export async function joinCommunity(id) {
  must(await sb().from('community_members').insert({ community_id: id, user_id: myId() }));
}

export async function leaveCommunity(id) {
  must(await sb().from('community_members').delete().eq('community_id', id).eq('user_id', myId()));
}

export async function members(id) {
  return must(
    await sb()
      .from('community_members')
      .select('user_id,joined_at')
      .eq('community_id', id)
      .order('joined_at')
      .limit(200)
  );
}

export async function communityBooks(id) {
  const rows = must(
    await sb().from('book_communities').select(`books(${BOOK_COLS})`).eq('community_id', id).limit(60)
  );
  return rows
    .map(r => r.books)
    .filter(b => b && b.visibility === 'public')
    .map(rowToMeta);
}

export async function posts(cid, page = 0, size = 20) {
  return must(
    await sb()
      .from('posts')
      .select('*, book:books(id,title)')
      .eq('community_id', cid)
      .order('created_at', { ascending: false })
      .range(page * size, page * size + size - 1)
  );
}

export async function post(id) {
  return must(await sb().from('posts').select('*, book:books(id,title)').eq('id', id).maybeSingle());
}

export async function createPost(p) {
  return must(
    await sb()
      .from('posts')
      .insert({
        community_id: p.cid,
        author_id: myId(),
        title: p.title,
        body: p.body,
        book_id: p.bookId || null
      })
      .select('*')
      .single()
  );
}

export async function deletePost(id) {
  must(await sb().from('posts').delete().eq('id', id));
}
