-- =====================================================================
-- Inkworlds database schema for Supabase
-- Run this whole file once in: Supabase dashboard > SQL Editor > New query
-- It is safe to re-run: every statement is idempotent.
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- Profiles (one row per account, created automatically on sign-up)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_url   text,
  prefs        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), ''), 60),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Books. The text itself lives in Storage (bucket "book-texts"),
-- gzipped JSON at <owner id>/<book id>.json.gz. Only metadata is here.
-- ---------------------------------------------------------------------
create table if not exists public.books (
  id            text primary key default gen_random_uuid()::text,
  owner_id      uuid references public.profiles(id) on delete cascade,  -- null only for built-in samples
  title         text not null check (char_length(title) between 1 and 200),
  author        text not null default '' check (char_length(author) <= 120),
  theme         text not null default 'auto',
  auto_theme    text not null default 'parchment',
  ai_reason     text not null default '' check (char_length(ai_reason) <= 200),
  hits          text[] not null default '{}',
  words         integer not null default 0,
  chapter_count integer not null default 0,
  text_path     text,
  visibility    text not null default 'private' check (visibility in ('private','public')),
  description   text not null default '' check (char_length(description) <= 500),
  rights_confirmed_at timestamptz,
  is_sample     boolean not null default false,
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz,
  constraint public_needs_rights check (visibility = 'private' or is_sample or rights_confirmed_at is not null)
);
create index if not exists books_owner_idx on public.books (owner_id, created_at desc);
create index if not exists books_public_idx on public.books (visibility, published_at desc);
create index if not exists books_title_trgm on public.books using gin (title gin_trgm_ops);
create index if not exists books_author_trgm on public.books using gin (author gin_trgm_ops);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists books_touch on public.books;
create trigger books_touch before update on public.books for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Personal reading data (only ever visible to its owner)
-- ---------------------------------------------------------------------
create table if not exists public.progress (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    text not null references public.books(id) on delete cascade,
  ch         integer not null default 0,
  frac       real not null default 0,
  pct        real not null default 0,
  max_pct    real not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table if not exists public.highlights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    text not null references public.books(id) on delete cascade,
  ch         integer not null,
  si         integer not null,
  start_off  integer not null,
  end_off    integer not null,
  text       text not null check (char_length(text) <= 4000),
  note       text not null default '' check (char_length(note) <= 2000),
  ch_title   text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists highlights_user_idx on public.highlights (user_id, book_id);

create table if not exists public.bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    text not null references public.books(id) on delete cascade,
  ch         integer not null,
  si         integer not null,
  snippet    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists bookmarks_user_idx on public.bookmarks (user_id, book_id);

create table if not exists public.reading_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day     date not null,
  secs    integer not null default 0,
  words   integer not null default 0,
  books   jsonb not null default '{}'::jsonb,
  worlds  jsonb not null default '{}'::jsonb,
  primary key (user_id, day)
);

-- Adds reading time atomically (no read-modify-write race between devices)
create or replace function public.add_reading(p_day date, p_secs integer, p_words integer, p_book text, p_world text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  p_secs := greatest(0, least(p_secs, 3600));
  p_words := greatest(0, least(p_words, 200000));
  insert into public.reading_days as r (user_id, day, secs, words, books, worlds)
  values (auth.uid(), p_day, p_secs, p_words,
          case when p_book is null or p_secs = 0 then '{}'::jsonb else jsonb_build_object(p_book, p_secs) end,
          case when p_world is null or p_secs = 0 then '{}'::jsonb else jsonb_build_object(p_world, p_secs) end)
  on conflict (user_id, day) do update set
    secs  = r.secs + excluded.secs,
    words = r.words + excluded.words,
    books = case when p_book is null or p_secs = 0 then r.books
                 else r.books || jsonb_build_object(p_book, coalesce((r.books->>p_book)::int, 0) + p_secs) end,
    worlds = case when p_world is null or p_secs = 0 then r.worlds
                 else r.worlds || jsonb_build_object(p_world, coalesce((r.worlds->>p_world)::int, 0) + p_secs) end;
end $$;

-- ---------------------------------------------------------------------
-- Communities, posts, comments, likes
-- ---------------------------------------------------------------------
create table if not exists public.communities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 3 and 60),
  description  text not null default '' check (char_length(description) <= 280),
  theme        text not null default 'parchment',
  owner_id     uuid references public.profiles(id) on delete set null,
  member_count integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists communities_created_idx on public.communities (created_at desc);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists members_user_idx on public.community_members (user_id);

create table if not exists public.book_communities (
  book_id      text not null references public.books(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  added_at     timestamptz not null default now(),
  primary key (book_id, community_id)
);
create index if not exists book_communities_c_idx on public.book_communities (community_id);

create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities(id) on delete cascade,
  author_id     uuid not null references public.profiles(id) on delete cascade,
  title         text not null check (char_length(title) between 3 and 120),
  body          text not null default '' check (char_length(body) <= 4000),
  book_id       text references public.books(id) on delete set null,
  comment_count integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists posts_community_idx on public.posts (community_id, created_at desc);

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('book','para','post')),
  book_id     text references public.books(id) on delete cascade,
  post_id     uuid references public.posts(id) on delete cascade,
  ch          integer,
  si          integer,
  quote       text not null default '' check (char_length(quote) <= 300),
  body        text not null check (char_length(body) between 1 and 2000),
  parent_id   uuid references public.comments(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint comment_target check (
    (target_type = 'post' and post_id is not null) or
    (target_type = 'book' and book_id is not null) or
    (target_type = 'para' and book_id is not null and ch is not null and si is not null))
);
create index if not exists comments_book_idx on public.comments (book_id, target_type, created_at);
create index if not exists comments_para_idx on public.comments (book_id, ch, si) where target_type = 'para';
create index if not exists comments_post_idx on public.comments (post_id, created_at);

create table if not exists public.likes (
  book_id    text not null references public.books(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (book_id, user_id)
);
create index if not exists likes_user_idx on public.likes (user_id);

-- Daily AI quota, used by the /api/claude serverless function
create table if not exists public.ai_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day     date not null default current_date,
  calls   integer not null default 0,
  primary key (user_id, day)
);
create or replace function public.ai_quota_hit(p_limit integer default 30)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.ai_usage as a (user_id, day, calls) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set calls = a.calls + 1
  returning calls into n;
  if n > p_limit then raise exception 'daily AI limit reached'; end if;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Counters maintained by triggers (security definer so they can update
-- rows the acting user doesn't own)
-- ---------------------------------------------------------------------
create or replace function public.bump_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare d integer := case when tg_op = 'INSERT' then 1 else -1 end;
        r record;
begin
  if tg_op = 'INSERT' then r := new; else r := old; end if;
  if tg_table_name = 'likes' then
    update public.books set like_count = greatest(0, like_count + d) where id = r.book_id;
  elsif tg_table_name = 'community_members' then
    update public.communities set member_count = greatest(0, member_count + d) where id = r.community_id;
  elsif tg_table_name = 'comments' then
    if r.target_type = 'post' then
      update public.posts set comment_count = greatest(0, comment_count + d) where id = r.post_id;
    else
      update public.books set comment_count = greatest(0, comment_count + d) where id = r.book_id;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists likes_count on public.likes;
create trigger likes_count after insert or delete on public.likes for each row execute function public.bump_counts();
drop trigger if exists members_count on public.community_members;
create trigger members_count after insert or delete on public.community_members for each row execute function public.bump_counts();
drop trigger if exists comments_count on public.comments;
create trigger comments_count after insert or delete on public.comments for each row execute function public.bump_counts();

-- The creator of a community joins it automatically
create or replace function public.join_own_community()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null then
    insert into public.community_members (community_id, user_id) values (new.id, new.owner_id) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists communities_join_owner on public.communities;
create trigger communities_join_owner after insert on public.communities for each row execute function public.join_own_community();

-- ---------------------------------------------------------------------
-- Row-level security: who can read and write what
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.books             enable row level security;
alter table public.progress          enable row level security;
alter table public.highlights        enable row level security;
alter table public.bookmarks         enable row level security;
alter table public.reading_days      enable row level security;
alter table public.communities       enable row level security;
alter table public.community_members enable row level security;
alter table public.book_communities  enable row level security;
alter table public.posts             enable row level security;
alter table public.comments          enable row level security;
alter table public.likes             enable row level security;
alter table public.ai_usage          enable row level security;

-- helper: can the current viewer see this book?
create or replace function public.can_see_book(p_book text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.books b where b.id = p_book and (b.visibility = 'public' or b.owner_id = auth.uid()));
$$;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "books visible" on public.books;
create policy "books visible" on public.books for select to anon, authenticated using (visibility = 'public' or owner_id = auth.uid());
drop policy if exists "books insert own" on public.books;
create policy "books insert own" on public.books for insert to authenticated with check (owner_id = auth.uid() and not is_sample);
drop policy if exists "books update own" on public.books;
create policy "books update own" on public.books for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and not is_sample);
drop policy if exists "books delete own" on public.books;
create policy "books delete own" on public.books for delete to authenticated using (owner_id = auth.uid());
-- counters are only changed by triggers
revoke update on public.books from authenticated;
grant update (title, author, theme, auto_theme, ai_reason, visibility, description, rights_confirmed_at, published_at) on public.books to authenticated;

do $$ declare t text; begin
  foreach t in array array['progress','highlights','bookmarks','reading_days'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
drop policy if exists "own usage" on public.ai_usage;
create policy "own usage" on public.ai_usage for select to authenticated using (user_id = auth.uid());

drop policy if exists "communities readable" on public.communities;
create policy "communities readable" on public.communities for select to anon, authenticated using (true);
drop policy if exists "communities create" on public.communities;
create policy "communities create" on public.communities for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "communities owner edit" on public.communities;
create policy "communities owner edit" on public.communities for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "communities owner delete" on public.communities;
create policy "communities owner delete" on public.communities for delete to authenticated using (owner_id = auth.uid());
revoke update on public.communities from authenticated;
grant update (name, description, theme) on public.communities to authenticated;

drop policy if exists "members readable" on public.community_members;
create policy "members readable" on public.community_members for select to anon, authenticated using (true);
drop policy if exists "members join self" on public.community_members;
create policy "members join self" on public.community_members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "members leave self" on public.community_members;
create policy "members leave self" on public.community_members for delete to authenticated using (user_id = auth.uid());

drop policy if exists "book_communities readable" on public.book_communities;
create policy "book_communities readable" on public.book_communities for select to anon, authenticated using (public.can_see_book(book_id));
drop policy if exists "book_communities owner" on public.book_communities;
create policy "book_communities owner" on public.book_communities for all to authenticated
  using (exists (select 1 from public.books b where b.id = book_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.books b where b.id = book_id and b.owner_id = auth.uid())
              and exists (select 1 from public.community_members m where m.community_id = book_communities.community_id and m.user_id = auth.uid()));

drop policy if exists "posts readable" on public.posts;
create policy "posts readable" on public.posts for select to anon, authenticated using (true);
drop policy if exists "posts members write" on public.posts;
create policy "posts members write" on public.posts for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.community_members m where m.community_id = posts.community_id and m.user_id = auth.uid()));
drop policy if exists "posts delete" on public.posts;
create policy "posts delete" on public.posts for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.communities c where c.id = community_id and c.owner_id = auth.uid()));

drop policy if exists "comments readable" on public.comments;
create policy "comments readable" on public.comments for select to anon, authenticated
  using (post_id is not null or public.can_see_book(book_id));
drop policy if exists "comments write" on public.comments;
create policy "comments write" on public.comments for insert to authenticated
  with check (author_id = auth.uid() and (post_id is not null or public.can_see_book(book_id)));
drop policy if exists "comments delete" on public.comments;
create policy "comments delete" on public.comments for delete to authenticated
  using (author_id = auth.uid()
         or exists (select 1 from public.books b where b.id = book_id and b.owner_id = auth.uid())
         or exists (select 1 from public.posts p join public.communities c on c.id = p.community_id where p.id = post_id and c.owner_id = auth.uid()));

drop policy if exists "likes readable" on public.likes;
create policy "likes readable" on public.likes for select to anon, authenticated using (true);
drop policy if exists "likes own" on public.likes;
create policy "likes own" on public.likes for insert to authenticated with check (user_id = auth.uid() and public.can_see_book(book_id));
drop policy if exists "likes remove own" on public.likes;
create policy "likes remove own" on public.likes for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Realtime: new comments are pushed to open readers
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- ---------------------------------------------------------------------
-- Storage: private bucket for book text. Owners read/write their own
-- folder; anyone can read the text of a book that is public.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('book-texts', 'book-texts', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "book text read" on storage.objects;
create policy "book text read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'book-texts' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.books b where b.text_path = storage.objects.name and b.visibility = 'public')));
drop policy if exists "book text write" on storage.objects;
create policy "book text write" on storage.objects for insert to authenticated
  with check (bucket_id = 'book-texts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "book text delete" on storage.objects;
create policy "book text delete" on storage.objects for delete to authenticated
  using (bucket_id = 'book-texts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Seed data: the two built-in sample stories (their text ships with the
-- app) and two starter communities
-- ---------------------------------------------------------------------
insert into public.books (id, owner_id, title, author, theme, auto_theme, words, chapter_count, visibility, is_sample, published_at)
values
  ('sample-vellmoor', null, 'The Lanterns of Vellmoor', 'An Inkworlds original', 'auto', 'gothic', 1000, 3, 'public', true, now()),
  ('sample-cartographer', null, 'The Cartographer''s Apprentice', 'An Inkworlds original', 'auto', 'parchment', 480, 2, 'public', true, now())
on conflict (id) do nothing;

insert into public.communities (name, description, theme, owner_id)
select 'Gothic Night Readers', 'Castles, moors, lanterns and letters. Slow reads of gothic stories, one chapter at a time.', 'gothic', null
where not exists (select 1 from public.communities where name = 'Gothic Night Readers');
insert into public.communities (name, description, theme, owner_id)
select 'Worldbuilders'' Guild', 'For readers of fantasy and magic. Share favourite spells, maps and apprentices.', 'parchment', null
where not exists (select 1 from public.communities where name = 'Worldbuilders'' Guild');
