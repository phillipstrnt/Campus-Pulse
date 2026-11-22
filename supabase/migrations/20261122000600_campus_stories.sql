create table if not exists public.campus_stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  caption varchar(500) not null default '',
  media_path text,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  check (length(trim(caption)) > 0 or media_path is not null)
);

alter table public.campus_stories enable row level security;
drop policy if exists "Members read active stories" on public.campus_stories;
create policy "Members read active stories" on public.campus_stories for select to authenticated
using (expires_at > now() and not public.are_users_blocked(auth.uid(), author_id));
drop policy if exists "Members create their stories" on public.campus_stories;
create policy "Members create their stories" on public.campus_stories for insert to authenticated
with check (author_id = auth.uid() and expires_at > now() and expires_at <= now() + interval '25 hours');
drop policy if exists "Owners and moderators remove stories" on public.campus_stories;
create policy "Owners and moderators remove stories" on public.campus_stories for delete to authenticated
using (author_id = auth.uid() or public.is_campus_moderator());

create index if not exists campus_stories_expiry_idx on public.campus_stories(expires_at desc);
create index if not exists campus_stories_author_idx on public.campus_stories(author_id, created_at desc);

drop policy if exists "Members view active story media" on storage.objects;
create policy "Members view active story media" on storage.objects for select to authenticated
using (bucket_id = 'campus-media' and exists (
  select 1 from public.campus_stories s where s.media_path = name and s.expires_at > now()
));

do $$ begin
  alter publication supabase_realtime add table public.campus_stories;
exception when duplicate_object then null;
end $$;
