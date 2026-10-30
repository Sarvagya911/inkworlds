-- Saved public books. This never transfers ownership.
create table if not exists public.book_library (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  book_id  text not null references public.books(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create index if not exists book_library_user_idx
  on public.book_library (user_id, added_at desc);

alter table public.book_library enable row level security;

drop policy if exists "library own read" on public.book_library;
create policy "library own read"
  on public.book_library
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "library add public" on public.book_library;
create policy "library add public"
  on public.book_library
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.books b
      where b.id = book_id
        and (b.visibility = 'public' or b.owner_id = auth.uid())
    )
  );

drop policy if exists "library remove own" on public.book_library;
create policy "library remove own"
  on public.book_library
  for delete to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
