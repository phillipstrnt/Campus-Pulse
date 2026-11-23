-- Moderator tools for student verification and manual beta tier management.
-- Tier changes here are administrative previews, not proof of payment.

create table if not exists public.campus_member_tiers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','plus','creator','promoter')),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.campus_member_tiers enable row level security;
drop policy if exists "Members view their own tier" on public.campus_member_tiers;
create policy "Members view their own tier" on public.campus_member_tiers for select to authenticated
using (user_id = auth.uid() or public.is_campus_moderator());
grant select on public.campus_member_tiers to authenticated;

-- Verification applications are created through the authenticated RPC only.
drop policy if exists "Members apply for verification" on public.verification_applications;
drop policy if exists "Members read own verification application" on public.verification_applications;
create policy "Members read own verification application" on public.verification_applications for select to authenticated
using (user_id = auth.uid() or public.is_campus_moderator());

create or replace function public.admin_list_members(search_term text default '', result_limit integer default 100)
returns table (
  user_id uuid,
  email text,
  username text,
  display_name text,
  university text,
  tier text,
  verification_status text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_campus_moderator() then
    raise exception using errcode = '42501', message = 'Moderator access required.';
  end if;
  return query
    select p.id, u.email::text, p.username, p.display_name, p.university,
      coalesce(t.tier, 'free'), p.verification_status, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.campus_member_tiers t on t.user_id = p.id
    where nullif(trim(search_term), '') is null
      or u.email ilike '%' || trim(search_term) || '%'
      or p.username ilike '%' || trim(search_term) || '%'
      or p.display_name ilike '%' || trim(search_term) || '%'
    order by p.created_at desc
    limit greatest(1, least(coalesce(result_limit, 100), 200));
end;
$$;

create or replace function public.admin_set_member_tier(target_user_id uuid, target_tier text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_campus_moderator() then
    raise exception using errcode = '42501', message = 'Moderator access required.';
  end if;
  if target_tier not in ('free','plus','creator','promoter') then
    raise exception using errcode = '22023', message = 'Choose a valid member tier.';
  end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception using errcode = 'P0002', message = 'Campus member not found.';
  end if;
  insert into public.campus_member_tiers(user_id, tier, updated_by, updated_at)
  values (target_user_id, target_tier, auth.uid(), now())
  on conflict (user_id) do update
    set tier = excluded.tier, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
end;
$$;

create or replace function public.submit_verification_application(p_document_path text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare current_user_id uuid := auth.uid(); application_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in before applying.';
  end if;
  if p_document_path is null or p_document_path not like current_user_id::text || '/verification-%' then
    raise exception using errcode = '22023', message = 'Upload an identity document to your private account folder.';
  end if;
  if not exists (select 1 from public.profiles where id = current_user_id) then
    raise exception using errcode = 'P0002', message = 'Campus profile not found.';
  end if;
  if exists (select 1 from public.profiles where id = current_user_id and verification_status = 'verified') then
    raise exception using errcode = '23505', message = 'This account is already verified.';
  end if;
  if exists (select 1 from public.verification_applications where user_id = current_user_id and status = 'pending') then
    raise exception using errcode = '23505', message = 'A verification application is already being reviewed.';
  end if;
  insert into public.verification_applications(user_id, document_path, status)
  values (current_user_id, p_document_path, 'pending') returning id into application_id;
  update public.profiles set verification_status = 'pending' where id = current_user_id;
  return application_id;
end;
$$;

create or replace function public.admin_review_verification(p_application_id uuid, p_review_status text)
returns void language plpgsql security definer set search_path = public
as $$
declare target_user uuid;
begin
  if not public.is_campus_moderator() then
    raise exception using errcode = '42501', message = 'Moderator access required.';
  end if;
  if p_review_status not in ('approved','rejected') then
    raise exception using errcode = '22023', message = 'Review must approve or reject the application.';
  end if;
  update public.verification_applications
    set status = p_review_status, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_application_id and status = 'pending'
    returning user_id into target_user;
  if target_user is null then
    raise exception using errcode = 'P0002', message = 'Pending verification application not found.';
  end if;
  update public.profiles
    set verification_status = case when p_review_status = 'approved' then 'verified' else 'rejected' end
    where id = target_user;
end;
$$;

revoke all on function public.admin_list_members(text,integer) from public, anon;
revoke all on function public.admin_set_member_tier(uuid,text) from public, anon;
revoke all on function public.submit_verification_application(text) from public, anon;
revoke all on function public.admin_review_verification(uuid,text) from public, anon;
grant execute on function public.admin_list_members(text,integer) to authenticated;
grant execute on function public.admin_set_member_tier(uuid,text) to authenticated;
grant execute on function public.submit_verification_application(text) to authenticated;
grant execute on function public.admin_review_verification(uuid,text) to authenticated;
