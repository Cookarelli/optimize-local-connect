begin;

alter table public.user_preferences
add column active_organization_id uuid references public.organizations(id) on delete set null;

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role public.membership_role not null,
  token_hash bytea not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  accepted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((status = 'accepted') = (accepted_at is not null))
);

create unique index organization_invitations_pending_email_idx
on public.organization_invitations (organization_id, email)
where status = 'pending';
create index organization_invitations_expiry_idx
on public.organization_invitations (expires_at)
where status = 'pending';

create trigger set_organization_invitations_updated_at
before update on public.organization_invitations
for each row execute function public.set_updated_at();

alter table public.organization_invitations enable row level security;

create policy "organization_invitations_read_admins"
on public.organization_invitations for select to authenticated using (
  public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[])
);

create policy "organization_invitations_revoke_admins"
on public.organization_invitations for update to authenticated using (
  public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[])
) with check (
  public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[])
  and status in ('pending', 'revoked')
);

create or replace function public.create_organization_invitation(
  target_organization_id uuid,
  target_email text,
  target_role public.membership_role,
  raw_token text,
  expiration timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_id uuid;
  normalized_email text := lower(trim(target_email));
begin
  if expiration <= now() or expiration > now() + interval '8 days' then
    raise exception 'invalid invitation expiration';
  end if;

  if not public.has_organization_role(target_organization_id, array['owner','admin']::public.membership_role[]) then
    raise exception 'not authorized to invite members';
  end if;

  if target_role in ('owner','admin')
    and not public.has_organization_role(target_organization_id, array['owner']::public.membership_role[])
    and not public.is_super_admin() then
    raise exception 'only owners can invite privileged members';
  end if;

  update public.organization_invitations
  set status = 'revoked', revoked_at = now()
  where organization_id = target_organization_id
    and email = normalized_email
    and status = 'pending';

  insert into public.organization_invitations (
    organization_id, email, role, token_hash, invited_by, expires_at
  ) values (
    target_organization_id,
    normalized_email,
    target_role,
    pg_catalog.sha256(pg_catalog.convert_to(raw_token, 'UTF8')),
    auth.uid(),
    expiration
  ) returning id into invitation_id;

  return invitation_id;
end;
$$;

create or replace function public.accept_organization_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.organization_invitations%rowtype;
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select * into invitation
  from public.organization_invitations
  where token_hash = pg_catalog.sha256(pg_catalog.convert_to(raw_token, 'UTF8'))
    and status = 'pending'
  for update;

  if not found or invitation.expires_at <= now() then
    raise exception 'invitation is invalid or expired';
  end if;
  if current_email = '' or current_email <> invitation.email then
    raise exception 'invitation email does not match signed-in user';
  end if;

  insert into public.organization_members (
    organization_id, user_id, role, status, invited_by
  ) values (
    invitation.organization_id, auth.uid(), invitation.role, 'active', invitation.invited_by
  )
  on conflict (organization_id, user_id) do update set
    role = excluded.role,
    status = 'active',
    invited_by = excluded.invited_by,
    updated_at = now();

  update public.organization_invitations set
    status = 'accepted',
    accepted_by = auth.uid(),
    accepted_at = now()
  where id = invitation.id;

  insert into public.user_preferences (user_id, active_organization_id)
  values (auth.uid(), invitation.organization_id)
  on conflict (user_id) do update set
    active_organization_id = coalesce(public.user_preferences.active_organization_id, excluded.active_organization_id),
    updated_at = now();

  return invitation.organization_id;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();
  return new;
end;
$$;

comment on table public.organization_invitations is 'Expiring, email-bound invitations to join an organization with a specific role.';
comment on column public.user_preferences.active_organization_id is 'Preferred organization context, accepted only when the user has an active membership.';

revoke all on function public.create_organization_invitation(uuid, text, public.membership_role, text, timestamptz) from public, anon;
revoke all on function public.accept_organization_invitation(text) from public, anon;
grant execute on function public.create_organization_invitation(uuid, text, public.membership_role, text, timestamptz) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;
grant select, update on public.organization_invitations to authenticated;

commit;
