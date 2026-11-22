-- Private campus messaging, account blocks, and user safety reports.
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
drop policy if exists "Members see blocks they created" on public.user_blocks;
create policy "Members see blocks they created" on public.user_blocks for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "Members block other campus users" on public.user_blocks;
create policy "Members block other campus users" on public.user_blocks for insert to authenticated with check (blocker_id = auth.uid() and blocked_id <> auth.uid());
drop policy if exists "Members unblock users" on public.user_blocks;
create policy "Members unblock users" on public.user_blocks for delete to authenticated using (blocker_id = auth.uid());
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id, blocker_id);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  content_type text not null check (content_type in ('user','message','reel','event','marketplace','hostel','live_room')),
  content_id text not null,
  reason text not null check (reason in ('spam','harassment','nudity','safety','fraud','underage','other')),
  details varchar(600) not null default '',
  status text not null default 'pending' check (status in ('pending','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz
);
alter table public.content_reports enable row level security;
drop policy if exists "Members submit safety reports" on public.content_reports;
create policy "Members submit safety reports" on public.content_reports for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists "Members and moderators read reports" on public.content_reports;
create policy "Members and moderators read reports" on public.content_reports for select to authenticated using (reporter_id = auth.uid() or public.is_campus_moderator());
drop policy if exists "Moderators resolve reports" on public.content_reports;
create policy "Moderators resolve reports" on public.content_reports for update to authenticated using (public.is_campus_moderator()) with check (public.is_campus_moderator());
create index if not exists content_reports_queue_idx on public.content_reports(status, created_at) where status in ('pending','reviewing');
create index if not exists content_reports_reporter_idx on public.content_reports(reporter_id, created_at desc);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  low_user_id uuid not null references public.profiles(id) on delete cascade,
  high_user_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (low_user_id, high_user_id),
  check (low_user_id < high_user_id)
);
create index if not exists conversations_low_user_idx on public.conversations(low_user_id, created_at desc);
create index if not exists conversations_high_user_idx on public.conversations(high_user_id, created_at desc);
alter table public.conversations enable row level security;
drop policy if exists "Conversation members read their threads" on public.conversations;
create policy "Conversation members read their threads" on public.conversations for select to authenticated using (low_user_id = auth.uid() or high_user_id = auth.uid());

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body varchar(2000) not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
drop policy if exists "Conversation members read their messages" on public.messages;
create policy "Conversation members read their messages" on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and (c.low_user_id = auth.uid() or c.high_user_id = auth.uid()))
);
create index if not exists messages_thread_page_idx on public.messages(conversation_id, created_at desc, id desc);
create index if not exists messages_sender_page_idx on public.messages(sender_id, created_at desc);

create or replace function public.has_active_messaging_subscription()
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.subscriptions s
    where s.user_id = auth.uid() and s.plan in ('plus','creator')
      and s.status = 'active' and s.current_period_end > now()
  );
$$;
revoke all on function public.has_active_messaging_subscription() from public;
grant execute on function public.has_active_messaging_subscription() to authenticated;

create or replace function public.can_send_in_conversation(p_conversation_id uuid)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  peer_id uuid;
begin
  if current_user_id is null or not public.has_active_messaging_subscription() then return false; end if;
  select case when c.low_user_id = current_user_id then c.high_user_id else c.low_user_id end
    into peer_id from public.conversations c
    where c.id = p_conversation_id and current_user_id in (c.low_user_id, c.high_user_id);
  if peer_id is null then return false; end if;
  return not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = current_user_id and b.blocked_id = peer_id)
       or (b.blocker_id = peer_id and b.blocked_id = current_user_id)
  );
end;
$$;
revoke all on function public.can_send_in_conversation(uuid) from public;
grant execute on function public.can_send_in_conversation(uuid) to authenticated;

drop policy if exists "Paid members send messages in their threads" on public.messages;
create policy "Paid members send messages in their threads" on public.messages for insert to authenticated with check (sender_id = auth.uid() and public.can_send_in_conversation(conversation_id));

create or replace function public.create_campus_conversation(target_user_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  low_id uuid;
  high_id uuid;
  new_conversation_id uuid;
begin
  if current_user_id is null then raise exception 'Sign in with your campus account first.'; end if;
  if target_user_id is null or target_user_id = current_user_id then raise exception 'Choose another campus member.'; end if;
  if not public.has_active_messaging_subscription() then raise exception 'An active Pulse Plus or Creator subscription is required to start a chat.'; end if;
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then raise exception 'Campus member not found.'; end if;
  if exists (select 1 from public.user_blocks b where (b.blocker_id = current_user_id and b.blocked_id = target_user_id) or (b.blocker_id = target_user_id and b.blocked_id = current_user_id)) then
    raise exception 'This member cannot be contacted.';
  end if;
  low_id := least(current_user_id, target_user_id);
  high_id := greatest(current_user_id, target_user_id);
  insert into public.conversations(low_user_id, high_user_id, created_by)
  values (low_id, high_id, current_user_id) on conflict (low_user_id, high_user_id) do nothing;
  select c.id into new_conversation_id from public.conversations c where c.low_user_id = low_id and c.high_user_id = high_id;
  return new_conversation_id;
end;
$$;
revoke all on function public.create_campus_conversation(uuid) from public;
grant execute on function public.create_campus_conversation(uuid) to authenticated;

-- Realtime is limited to the member's conversation by the messages RLS policy.
do $$
declare table_name text;
begin
  foreach table_name in array array['messages','subscriptions','marketplace_listings','hostel_listings','live_rooms'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
