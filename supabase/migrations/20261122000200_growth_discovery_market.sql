-- Campus Pulse growth and trust migration. Apply after 20261122000100_campus_pulse.sql.
create extension if not exists postgis with schema extensions;
create schema if not exists private;

-- Maintained by campus administrators in the Supabase SQL editor.
create table if not exists public.campus_email_domains (
  email_domain text primary key check (email_domain = lower(trim(email_domain)) and position('@' in email_domain) = 0),
  campus_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.campus_email_domains enable row level security;
drop policy if exists "Public can view active campus domains" on public.campus_email_domains;
create policy "Public can view active campus domains" on public.campus_email_domains for select to anon, authenticated using (active);
insert into public.campus_email_domains(email_domain, campus_name) values
  ('mak.ac.ug', 'Makerere University'),
  ('students.mak.ac.ug', 'Makerere University'),
  ('chs.mak.ac.ug', 'Makerere University')
on conflict (email_domain) do nothing;

alter table public.profiles add column if not exists interests text[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_interests_check;
alter table public.profiles add constraint profiles_interests_check check (interests <@ array['Campus life','Sports','Science & tech','Drama & arts','Entertainment','Dating 18+']::text[]);
create table if not exists private.account_identities (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_fingerprint text not null unique
);
revoke all on private.account_identities from anon, authenticated;
with normalized_accounts as (
  select p.id as user_id, p.created_at,
    case when lower(split_part(u.email, '@', 2)) in ('gmail.com','googlemail.com')
      then replace(split_part(split_part(lower(trim(u.email)), '@', 1), '+', 1), '.', '') || '@gmail.com'
      else lower(trim(u.email)) end as normalized_email
  from public.profiles p join auth.users u on u.id = p.id where u.email is not null
), fingerprinted as (
  select user_id, created_at, encode(digest(normalized_email, 'sha256'), 'hex') as fingerprint from normalized_accounts
)
insert into private.account_identities(user_id, email_fingerprint)
select distinct on (fingerprint) user_id, fingerprint from fingerprinted order by fingerprint, created_at
on conflict (user_id) do nothing;
create index if not exists profiles_interests_gin on public.profiles using gin(interests);

-- Enforce campus domain and adult signup at the database boundary. The DOB is checked, then discarded.
create or replace function public.validate_campus_signup()
returns trigger language plpgsql security definer set search_path = public, extensions
as $$
declare
  signup_domain text;
  birthday date;
begin
  if new.email is null or position('@' in new.email) = 0 then
    raise exception using errcode = '23514', message = 'Enter a valid campus email address.';
  end if;
  signup_domain := lower(split_part(trim(new.email), '@', 2));
  if not exists (select 1 from public.campus_email_domains d where d.active and d.email_domain = signup_domain) then
    raise exception using errcode = '23514', message = 'This email domain is not approved for Campus Pulse. Use your university-issued email.';
  end if;
  if coalesce(new.raw_user_meta_data->>'date_of_birth', '') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception using errcode = '23514', message = 'Enter your date of birth. Campus Pulse is for adults aged 18 and over.';
  end if;
  birthday := (new.raw_user_meta_data->>'date_of_birth')::date;
  if birthday > (current_date - interval '18 years')::date then
    raise exception using errcode = '23514', message = 'Campus Pulse is for adults aged 18 and over.';
  end if;
  new.raw_user_meta_data := (coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'date_of_birth');
  return new;
end;
$$;
drop trigger if exists validate_campus_signup on auth.users;
create trigger validate_campus_signup before insert on auth.users for each row execute procedure public.validate_campus_signup();

-- A normalized, one-way identity fingerprint blocks repeated exact addresses and common Gmail aliases.
create or replace function public.create_campus_profile()
returns trigger language plpgsql security definer set search_path = public, private, extensions
as $$
declare
  normalized text := lower(trim(coalesce(new.email, '')));
  local_part text;
  mail_domain text;
  campus text;
begin
  mail_domain := split_part(normalized, '@', 2);
  local_part := split_part(normalized, '@', 1);
  if mail_domain in ('gmail.com', 'googlemail.com') then
    local_part := replace(split_part(local_part, '+', 1), '.', '');
    mail_domain := 'gmail.com';
  end if;
  normalized := local_part || '@' || mail_domain;
  select d.campus_name into campus from public.campus_email_domains d where d.active and d.email_domain = split_part(lower(coalesce(new.email, '')), '@', 2);
  insert into public.profiles (id, display_name, university, interests)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Campus member'),
    coalesce(new.raw_user_meta_data->>'university', campus, ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'interests', '[]'::jsonb))), '{}')
  ) on conflict (id) do nothing;
  insert into private.account_identities(user_id, email_fingerprint)
  values (new.id, encode(digest(normalized, 'sha256'), 'hex'));
  return new;
end;
$$;

-- Adult dating is allowed as a category; explicit sexual/nude media remains prohibited by policy/moderation.
alter table public.reels add column if not exists category text not null default 'Campus life';
alter table public.reels drop constraint if exists reels_category_check;
alter table public.reels add constraint reels_category_check check (category in ('Campus life','Sports','Science & tech','Drama & arts','Entertainment','Dating 18+'));
create index if not exists reels_feed_page_idx on public.reels(moderation_status, university, created_at desc);
create index if not exists reels_category_page_idx on public.reels(category, created_at desc) where moderation_status = 'approved';
create index if not exists campus_events_feed_page_idx on public.campus_events(moderation_status, university, starts_at desc);
create index if not exists event_rsvps_user_idx on public.event_rsvps(user_id, created_at desc);
create index if not exists subscriptions_active_idx on public.subscriptions(user_id, status, current_period_end desc);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(90) not null,
  description varchar(1200) not null,
  category text not null check (category in ('Study essentials','Electronics','Fashion','Transport','Room & living')),
  price_amount numeric(12,2) not null check (price_amount >= 0),
  currency char(3) not null default 'UGX' check (currency = 'UGX'),
  location varchar(120) not null,
  photo_paths text[] not null default '{}',
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(photo_paths) <= 4)
);
alter table public.marketplace_listings enable row level security;
drop policy if exists "Campus members view approved or own listings" on public.marketplace_listings;
create policy "Campus members view approved or own listings" on public.marketplace_listings for select to authenticated using (moderation_status = 'approved' or seller_id = auth.uid() or public.is_campus_moderator());
drop policy if exists "Members submit pending marketplace listings" on public.marketplace_listings;
create policy "Members submit pending marketplace listings" on public.marketplace_listings for insert to authenticated with check (seller_id = auth.uid() and moderation_status = 'pending');
drop policy if exists "Sellers edit pending listings" on public.marketplace_listings;
create policy "Sellers edit pending listings" on public.marketplace_listings for update to authenticated using (seller_id = auth.uid()) with check (seller_id = auth.uid() and moderation_status = 'pending');
drop policy if exists "Moderators review marketplace listings" on public.marketplace_listings;
create policy "Moderators review marketplace listings" on public.marketplace_listings for update to authenticated using (public.is_campus_moderator()) with check (public.is_campus_moderator());
drop policy if exists "Sellers remove listings" on public.marketplace_listings;
create policy "Sellers remove listings" on public.marketplace_listings for delete to authenticated using (seller_id = auth.uid() or public.is_campus_moderator());
create index if not exists marketplace_approved_feed_idx on public.marketplace_listings(category, created_at desc) where moderation_status = 'approved';
create index if not exists marketplace_seller_idx on public.marketplace_listings(seller_id, created_at desc);

create table if not exists public.hostel_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  hostel_name varchar(120) not null,
  room_title varchar(90) not null,
  room_type text not null check (room_type in ('Single room','Shared room','Studio')),
  description varchar(1600) not null,
  amenities text[] not null default '{}',
  price_amount numeric(12,2) not null check (price_amount >= 0),
  currency char(3) not null default 'UGX' check (currency = 'UGX'),
  location varchar(160) not null,
  photo_paths text[] not null default '{}',
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(photo_paths) <= 4)
);
alter table public.hostel_listings enable row level security;
drop policy if exists "Campus members view approved or own hostels" on public.hostel_listings;
create policy "Campus members view approved or own hostels" on public.hostel_listings for select to authenticated using (moderation_status = 'approved' or owner_id = auth.uid() or public.is_campus_moderator());
drop policy if exists "Owners submit pending hostels" on public.hostel_listings;
create policy "Owners submit pending hostels" on public.hostel_listings for insert to authenticated with check (owner_id = auth.uid() and moderation_status = 'pending');
drop policy if exists "Owners edit pending hostels" on public.hostel_listings;
create policy "Owners edit pending hostels" on public.hostel_listings for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and moderation_status = 'pending');
drop policy if exists "Moderators review hostel listings" on public.hostel_listings;
create policy "Moderators review hostel listings" on public.hostel_listings for update to authenticated using (public.is_campus_moderator()) with check (public.is_campus_moderator());
drop policy if exists "Owners remove hostels" on public.hostel_listings;
create policy "Owners remove hostels" on public.hostel_listings for delete to authenticated using (owner_id = auth.uid() or public.is_campus_moderator());
create index if not exists hostel_approved_feed_idx on public.hostel_listings(room_type, created_at desc) where moderation_status = 'approved';
create index if not exists hostel_owner_idx on public.hostel_listings(owner_id, created_at desc);

-- Location is private. Only opt-in users can be returned by the nearby RPC; callers never receive coordinates.
create table if not exists private.profile_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  location extensions.geography(point, 4326) not null,
  discovery_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists profile_locations_geog_idx on private.profile_locations using gist(location) where discovery_enabled;
alter table private.profile_locations enable row level security;
revoke all on private.profile_locations from anon, authenticated;

create or replace function public.set_my_approximate_location(latitude double precision, longitude double precision, enabled boolean default true)
returns void language plpgsql security definer set search_path = public, private, extensions
as $$
begin
  if auth.uid() is null then raise exception 'Sign in before enabling nearby discovery.'; end if;
  if not enabled then delete from private.profile_locations where user_id = auth.uid(); return; end if;
  if latitude not between -90 and 90 or longitude not between -180 and 180 then raise exception 'Invalid location.'; end if;
  insert into private.profile_locations(user_id, location, discovery_enabled, updated_at)
  values (auth.uid(), extensions.st_setsrid(extensions.st_makepoint(round(longitude::numeric, 2)::double precision, round(latitude::numeric, 2)::double precision), 4326)::extensions.geography, true, now())
  on conflict (user_id) do update set location = excluded.location, discovery_enabled = true, updated_at = now();
end;
$$;
revoke all on function public.set_my_approximate_location(double precision,double precision,boolean) from public;
grant execute on function public.set_my_approximate_location(double precision,double precision,boolean) to authenticated;

create or replace function public.find_nearby_students(radius_km integer default 5)
returns table(id uuid, display_name text, university text, interests text[], approximate_distance_km integer)
language plpgsql stable security definer set search_path = public, private, extensions
as $$
declare caller_location extensions.geography;
begin
  if auth.uid() is null then raise exception 'Sign in before using nearby discovery.'; end if;
  if radius_km not between 1 and 20 then raise exception 'Choose a radius between 1 and 20 km.'; end if;
  select l.location into caller_location from private.profile_locations l where l.user_id = auth.uid() and l.discovery_enabled;
  if caller_location is null then raise exception 'Turn on approximate location first.'; end if;
  return query
    select p.id, p.display_name, p.university, p.interests,
      round(extensions.st_distance(l.location, caller_location) / 1000.0)::integer
    from private.profile_locations l join public.profiles p on p.id = l.user_id
    where l.discovery_enabled and l.user_id <> auth.uid()
      and extensions.st_dwithin(l.location, caller_location, radius_km * 1000.0)
    order by l.location <-> caller_location
    limit 50;
end;
$$;
revoke all on function public.find_nearby_students(integer) from public;
grant execute on function public.find_nearby_students(integer) to authenticated;

-- Live room listings are separate from the video transport. A room provider/server is still needed for actual streams.
create table if not exists public.live_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(100) not null,
  description varchar(500) not null default '',
  university text not null default '',
  category text not null default 'Campus life' check (category in ('Campus life','Sports','Science & tech','Drama & arts','Entertainment')),
  starts_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.live_rooms enable row level security;
drop policy if exists "Members see approved live rooms" on public.live_rooms;
create policy "Members see approved live rooms" on public.live_rooms for select to authenticated using (moderation_status = 'approved' or host_id = auth.uid() or public.is_campus_moderator());
drop policy if exists "Members schedule rooms for review" on public.live_rooms;
create policy "Members schedule rooms for review" on public.live_rooms for insert to authenticated with check (host_id = auth.uid() and status = 'scheduled' and moderation_status = 'pending');
drop policy if exists "Hosts edit pending rooms" on public.live_rooms;
create policy "Hosts edit pending rooms" on public.live_rooms for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid() and moderation_status = 'pending');
drop policy if exists "Moderators manage live rooms" on public.live_rooms;
create policy "Moderators manage live rooms" on public.live_rooms for all to authenticated using (public.is_campus_moderator()) with check (public.is_campus_moderator());
create index if not exists live_rooms_campus_schedule_idx on public.live_rooms(university, starts_at desc) where moderation_status = 'approved' and status in ('scheduled','live');

-- Let authenticated campus members read images attached to approved marketplace and hostel listings.
drop policy if exists "Members view approved listing media" on storage.objects;
create policy "Members view approved listing media" on storage.objects for select to authenticated using (
  bucket_id = 'campus-media' and (
    exists (select 1 from public.marketplace_listings m where m.moderation_status = 'approved' and name = any(m.photo_paths)) or
    exists (select 1 from public.hostel_listings h where h.moderation_status = 'approved' and name = any(h.photo_paths))
  )
);

update storage.buckets set allowed_mime_types = array['video/mp4','video/webm','image/jpeg','image/png','image/webp','application/pdf'] where id = 'campus-media';
