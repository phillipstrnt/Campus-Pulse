-- Open beta identity, social graph, and free pilot access.
-- Apply after migrations 001-004. Supabase Auth must have email confirmations enabled.

alter table public.profiles add column if not exists username varchar(24);
alter table public.profiles add column if not exists profile_photo_path text;
alter table public.profiles add column if not exists bio varchar(240) not null default '';
update storage.buckets set allowed_mime_types = array['video/mp4','video/webm','audio/webm','audio/ogg','audio/mp4','image/jpeg','image/png','image/webp','application/pdf'] where id = 'campus-media';

update public.profiles
set username = left(lower(regexp_replace(coalesce(nullif(display_name, ''), 'student'), '[^a-zA-Z0-9_]+', '', 'g')), 17) || '_' || substr(replace(id::text, '-', ''), 1, 6)
where username is null or btrim(username) = '';
alter table public.profiles alter column username set not null;
create unique index if not exists profiles_username_ci_unique on public.profiles (lower(username));
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_]{3,24}$');
create or replace function public.is_username_available(candidate text)
returns boolean language sql stable security definer set search_path = public
as $$ select candidate ~ '^[a-zA-Z0-9_]{3,24}$' and not exists (select 1 from public.profiles p where lower(p.username) = lower(candidate)) $$;
revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- Accept any syntactically valid email and defer proof of ownership to Supabase's
-- confirmation link. Student age remains 18+ for dating and campus social features.
create or replace function public.validate_campus_signup()
returns trigger language plpgsql security definer set search_path = public, extensions
as $$
declare birthday date;
begin
  if new.email is null or lower(trim(new.email)) !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
    raise exception using errcode = '23514', message = 'Enter a valid email address. We will send a confirmation link before your account is enabled.';
  end if;
  if coalesce(new.raw_user_meta_data->>'date_of_birth', '') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception using errcode = '23514', message = 'Enter your date of birth. Campus Pulse social accounts are for adults aged 18 and over.';
  end if;
  birthday := (new.raw_user_meta_data->>'date_of_birth')::date;
  if birthday > (current_date - interval '18 years')::date then
    raise exception using errcode = '23514', message = 'Campus Pulse social accounts are for adults aged 18 and over.';
  end if;
  new.email := lower(trim(new.email));
  new.raw_user_meta_data := (coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'date_of_birth');
  return new;
end;
$$;

-- Rebuild profile trigger to initialize a unique username from signup metadata.
create or replace function public.create_campus_profile()
returns trigger language plpgsql security definer set search_path = public, private, extensions
as $$
declare
  normalized text := lower(trim(coalesce(new.email, '')));
  local_part text;
  mail_domain text;
  campus text;
  requested_username text;
  safe_username text;
begin
  mail_domain := split_part(normalized, '@', 2);
  local_part := split_part(normalized, '@', 1);
  if mail_domain in ('gmail.com', 'googlemail.com') then
    local_part := replace(split_part(local_part, '+', 1), '.', '');
    mail_domain := 'gmail.com';
  end if;
  normalized := local_part || '@' || mail_domain;
  requested_username := lower(coalesce(new.raw_user_meta_data->>'username', ''));
  safe_username := regexp_replace(requested_username, '[^a-z0-9_]', '', 'g');
  if length(safe_username) < 3 then
    safe_username := 'student_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  safe_username := left(safe_username, 24);
  select d.campus_name into campus from public.campus_email_domains d where d.active and d.email_domain = mail_domain;
  insert into public.profiles (id, display_name, username, university, interests)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Campus member'),
    safe_username,
    coalesce(new.raw_user_meta_data->>'university', campus, 'Independent member'),
    coalesce(array(select jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'interests', '[]'::jsonb))), '{}')
  ) on conflict (id) do nothing;
  insert into private.account_identities(user_id, email_fingerprint)
  values (new.id, encode(digest(normalized, 'sha256'), 'hex'));
  return new;
end;
$$;

create or replace function public.protect_profile_trust_fields()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.verification_status is distinct from old.verification_status)
    and not public.is_campus_moderator() then
    raise exception using errcode = '42501', message = 'Role and verification status can only be changed by campus moderators.';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_trust_fields on public.profiles;
create trigger protect_profile_trust_fields before update on public.profiles
for each row execute procedure public.protect_profile_trust_fields();

create or replace function public.are_users_blocked(first_user uuid, second_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_blocks b where (b.blocker_id = first_user and b.blocked_id = second_user) or (b.blocker_id = second_user and b.blocked_id = first_user));
$$;
revoke all on function public.are_users_blocked(uuid,uuid) from public, anon;
grant execute on function public.are_users_blocked(uuid,uuid) to authenticated;

create table if not exists public.campus_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
alter table public.campus_follows enable row level security;
drop policy if exists "Members read campus follows" on public.campus_follows;
create policy "Members read campus follows" on public.campus_follows for select to authenticated
using (
  (follower_id = auth.uid() or followed_id = auth.uid())
  and not public.are_users_blocked(auth.uid(), follower_id)
  and not public.are_users_blocked(auth.uid(), followed_id)
);
drop policy if exists "Members follow campus profiles" on public.campus_follows;
create policy "Members follow campus profiles" on public.campus_follows for insert to authenticated
with check (follower_id = auth.uid() and followed_id <> auth.uid() and not public.are_users_blocked(auth.uid(), followed_id));
drop policy if exists "Members unfollow campus profiles" on public.campus_follows;
create policy "Members unfollow campus profiles" on public.campus_follows for delete to authenticated using (follower_id = auth.uid());
create index if not exists campus_follows_followed_idx on public.campus_follows(followed_id, created_at desc);

create table if not exists public.campus_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body varchar(2000) not null default '',
  category text not null default 'Campus life',
  media_paths text[] not null default '{}',
  link_url text,
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  check (length(trim(body)) > 0 or cardinality(media_paths) > 0 or link_url is not null),
  check (link_url is null or link_url ~ '^https://')
);
alter table public.campus_posts enable row level security;
drop policy if exists "Campus sees approved posts" on public.campus_posts;
create policy "Campus sees approved posts" on public.campus_posts for select to authenticated using (
  (moderation_status = 'approved' or author_id = auth.uid() or public.is_campus_moderator())
  and not exists (select 1 from public.user_blocks b where (b.blocker_id = auth.uid() and b.blocked_id = author_id) or (b.blocked_id = auth.uid() and b.blocker_id = author_id))
);
drop policy if exists "Members create own campus posts" on public.campus_posts;
create policy "Members create own campus posts" on public.campus_posts for insert to authenticated with check (author_id = auth.uid() and moderation_status = 'pending');
drop policy if exists "Owners and moderators manage campus posts" on public.campus_posts;
create policy "Owners and moderators manage campus posts" on public.campus_posts for update to authenticated using (author_id = auth.uid() or public.is_campus_moderator()) with check (author_id = auth.uid() or public.is_campus_moderator());
drop policy if exists "Owners and moderators remove campus posts" on public.campus_posts;
create policy "Owners and moderators remove campus posts" on public.campus_posts for delete to authenticated using (author_id = auth.uid() or public.is_campus_moderator());
create index if not exists campus_posts_feed_idx on public.campus_posts(moderation_status, created_at desc);
create index if not exists campus_posts_author_idx on public.campus_posts(author_id, created_at desc);

drop policy if exists "Members submit events for review" on public.campus_events;
create policy "Members submit events for review" on public.campus_events for insert to authenticated
with check (created_by = auth.uid() and moderation_status = 'pending' and is_announcement = false);

create table if not exists public.campus_post_reactions (
  post_id uuid not null references public.campus_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null default 'like' check (reaction in ('like','love','laugh','celebrate')),
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);
alter table public.campus_post_reactions enable row level security;
drop policy if exists "Members view post reactions" on public.campus_post_reactions;
create policy "Members view post reactions" on public.campus_post_reactions for select to authenticated using (exists (select 1 from public.campus_posts p where p.id = post_id and p.moderation_status = 'approved'));
drop policy if exists "Members react to campus posts" on public.campus_post_reactions;
create policy "Members react to campus posts" on public.campus_post_reactions for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.campus_posts p where p.id = post_id and p.moderation_status = 'approved'));
drop policy if exists "Members remove their post reactions" on public.campus_post_reactions;
create policy "Members remove their post reactions" on public.campus_post_reactions for delete to authenticated using (user_id = auth.uid());

create table if not exists public.campus_post_favorites (
  post_id uuid not null references public.campus_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);
alter table public.campus_post_favorites enable row level security;
drop policy if exists "Members see own saved posts" on public.campus_post_favorites;
create policy "Members see own saved posts" on public.campus_post_favorites for select to authenticated using (user_id = auth.uid());
drop policy if exists "Members save visible posts" on public.campus_post_favorites;
create policy "Members save visible posts" on public.campus_post_favorites for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.campus_posts p where p.id = post_id and p.moderation_status = 'approved'));
drop policy if exists "Members unsave own posts" on public.campus_post_favorites;
create policy "Members unsave own posts" on public.campus_post_favorites for delete to authenticated using (user_id = auth.uid());

create table if not exists public.campus_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.campus_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.campus_post_comments(id) on delete cascade,
  body varchar(1000) not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.campus_post_comments enable row level security;
drop policy if exists "Members read comments on visible posts" on public.campus_post_comments;
create policy "Members read comments on visible posts" on public.campus_post_comments for select to authenticated using (exists (select 1 from public.campus_posts p where p.id = post_id and p.moderation_status = 'approved'));
drop policy if exists "Members comment on visible posts" on public.campus_post_comments;
create policy "Members comment on visible posts" on public.campus_post_comments for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.campus_posts p where p.id = post_id and p.moderation_status = 'approved'));
drop policy if exists "Members edit or remove own comments" on public.campus_post_comments;
create policy "Members edit or remove own comments" on public.campus_post_comments for all to authenticated using (user_id = auth.uid() or public.is_campus_moderator()) with check (user_id = auth.uid() or public.is_campus_moderator());

-- Free open beta: subscriptions stay dormant, and social messaging requires mutual follows.
create or replace function public.has_active_messaging_subscription()
returns boolean language sql stable security definer set search_path = public
as $$ select auth.uid() is not null $$;

create or replace function public.can_send_in_conversation(p_conversation_id uuid)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare current_user_id uuid := auth.uid(); peer_id uuid;
begin
  if current_user_id is null then return false; end if;
  select case when c.low_user_id = current_user_id then c.high_user_id else c.low_user_id end
    into peer_id from public.conversations c where c.id = p_conversation_id and current_user_id in (c.low_user_id,c.high_user_id);
  if peer_id is null then return false; end if;
  return not exists (select 1 from public.user_blocks b where (b.blocker_id = current_user_id and b.blocked_id = peer_id) or (b.blocker_id = peer_id and b.blocked_id = current_user_id))
    and exists (select 1 from public.campus_follows f where f.follower_id = current_user_id and f.followed_id = peer_id)
    and exists (select 1 from public.campus_follows f where f.follower_id = peer_id and f.followed_id = current_user_id);
end;
$$;

create or replace function public.create_campus_conversation(target_user_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare current_user_id uuid := auth.uid(); low_id uuid; high_id uuid; new_conversation_id uuid;
begin
  if current_user_id is null then raise exception 'Sign in first.'; end if;
  if target_user_id is null or target_user_id = current_user_id then raise exception 'Choose another campus member.'; end if;
  if exists (select 1 from public.user_blocks b where (b.blocker_id = current_user_id and b.blocked_id = target_user_id) or (b.blocker_id = target_user_id and b.blocked_id = current_user_id)) then raise exception 'You cannot message this user.'; end if;
  if not exists (select 1 from public.campus_follows f where f.follower_id = current_user_id and f.followed_id = target_user_id)
     or not exists (select 1 from public.campus_follows f where f.follower_id = target_user_id and f.followed_id = current_user_id) then
    raise exception 'Follow each other to open a conversation.';
  end if;
  low_id := least(current_user_id,target_user_id); high_id := greatest(current_user_id,target_user_id);
  insert into public.conversations(low_user_id,high_user_id,created_by) values (low_id,high_id,current_user_id) on conflict (low_user_id,high_user_id) do nothing;
  select c.id into new_conversation_id from public.conversations c where c.low_user_id = low_id and c.high_user_id = high_id;
  return new_conversation_id;
end;
$$;

drop policy if exists "Conversation members read their threads" on public.conversations;
create policy "Mutual followers read their threads" on public.conversations for select to authenticated using (public.can_send_in_conversation(id));
drop policy if exists "Conversation members read their messages" on public.messages;
create policy "Mutual followers read their messages" on public.messages for select to authenticated using (public.can_send_in_conversation(conversation_id));

drop policy if exists "Profiles are visible to campus members" on public.profiles;
create policy "Profiles are visible unless blocked" on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_campus_moderator() or not public.are_users_blocked(auth.uid(), id)
);

drop policy if exists "Members view campus content photos" on storage.objects;
create policy "Members view campus content photos" on storage.objects for select to authenticated using (
  bucket_id = 'campus-media' and (
    exists (select 1 from public.profiles p where p.profile_photo_path = name)
    or exists (select 1 from public.campus_posts p where name = any(p.media_paths) and p.moderation_status = 'approved')
  )
);

do $$ declare t text; begin
  foreach t in array array['campus_follows','campus_posts','campus_post_reactions','campus_post_favorites','campus_post_comments'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
