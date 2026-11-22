-- Campus Pulse starter schema for Supabase (Postgres + Auth + Storage + Realtime).
-- Run in a new Supabase project. Never put service_role or payment secrets in the client.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Campus member',
  university text not null default '',
  role text not null default 'student' check (role in ('student','moderator','admin')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected')),
  created_at timestamptz not null default now()
);

create or replace function public.create_campus_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Campus member'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_campus_profile on auth.users;
create trigger on_auth_user_created_campus_profile
  after insert on auth.users
  for each row execute procedure public.create_campus_profile();

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  caption varchar(220) not null default '',
  video_path text not null,
  university text not null default '',
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.campus_events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  title varchar(100) not null,
  venue text not null,
  details text not null default '',
  starts_at timestamptz,
  university text not null default '',
  promoted boolean not null default false,
  is_announcement boolean not null default false,
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.event_rsvps (
  event_id uuid not null references public.campus_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Only a server-side payment webhook should write this table after verifying a charge.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('plus','creator','promoter')),
  status text not null check (status in ('active','past_due','cancelled','expired')),
  provider text not null default 'flutterwave',
  provider_reference text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.reels enable row level security;
alter table public.campus_events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.subscriptions enable row level security;
alter table public.verification_applications enable row level security;

create or replace function public.is_campus_moderator()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator','admin')) $$;

create policy "Profiles are visible to campus members" on public.profiles for select to authenticated using (true);
create policy "Members create their own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "Members update their own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = 'student');

create policy "Approved reels are visible" on public.reels for select to authenticated using (moderation_status = 'approved' or user_id = auth.uid() or public.is_campus_moderator());
create policy "Members submit own reels" on public.reels for insert to authenticated with check (user_id = auth.uid());
create policy "Moderators review reels" on public.reels for update to authenticated using (public.is_campus_moderator()) with check (public.is_campus_moderator());
create policy "Owners remove own reels" on public.reels for delete to authenticated using (user_id = auth.uid() or public.is_campus_moderator());

create policy "Approved events are visible" on public.campus_events for select to authenticated using (moderation_status = 'approved' or created_by = auth.uid() or public.is_campus_moderator());
create policy "Members submit events for review" on public.campus_events for insert to authenticated with check (created_by = auth.uid() and moderation_status = 'pending' and promoted = false and is_announcement = false);
create policy "Moderators publish announcements" on public.campus_events for insert to authenticated with check (public.is_campus_moderator());
create policy "Moderators review events" on public.campus_events for update to authenticated using (public.is_campus_moderator()) with check (public.is_campus_moderator());
create policy "Owners or moderators remove events" on public.campus_events for delete to authenticated using (created_by = auth.uid() or public.is_campus_moderator());

create policy "Members see RSVP counts" on public.event_rsvps for select to authenticated using (true);
create policy "Members RSVP as themselves" on public.event_rsvps for insert to authenticated with check (user_id = auth.uid());
create policy "Members remove their RSVP" on public.event_rsvps for delete to authenticated using (user_id = auth.uid());
create policy "Members read their subscriptions" on public.subscriptions for select to authenticated using (user_id = auth.uid());
create policy "Members read own verification application" on public.verification_applications for select to authenticated using (user_id = auth.uid() or public.is_campus_moderator());
create policy "Members apply for verification" on public.verification_applications for insert to authenticated with check (user_id = auth.uid());
create policy "Moderators review verification" on public.verification_applications for update to authenticated using (public.is_campus_moderator()) with check (public.is_campus_moderator());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campus-media', 'campus-media', false, 52428800, array['video/mp4','video/webm','image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;
create policy "Members upload to their own folder" on storage.objects for insert to authenticated with check (bucket_id = 'campus-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Members view campus media" on storage.objects for select to authenticated using (bucket_id = 'campus-media' and (storage.foldername(name))[1] = auth.uid()::text or bucket_id = 'campus-media' and public.is_campus_moderator());
create policy "Members remove their own uploads" on storage.objects for delete to authenticated using (bucket_id = 'campus-media' and (storage.foldername(name))[1] = auth.uid()::text);

alter publication supabase_realtime add table public.campus_events;
alter publication supabase_realtime add table public.reels;
