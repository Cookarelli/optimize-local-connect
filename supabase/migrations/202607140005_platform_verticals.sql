begin;

create table public.industry_verticals (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null unique check (char_length(name) between 2 and 120),
  description text not null,
  status text not null default 'planned' check (status in ('launch', 'active', 'planned', 'paused', 'retired')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_verticals (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vertical_id uuid not null references public.industry_verticals(id) on delete restrict,
  status text not null default 'active' check (status in ('onboarding', 'active', 'paused')),
  is_primary boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  activated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, vertical_id)
);

create unique index organization_verticals_one_primary_idx
on public.organization_verticals (organization_id)
where is_primary and status = 'active';
create index organization_verticals_vertical_idx
on public.organization_verticals (vertical_id, status, organization_id);

create trigger set_industry_verticals_updated_at
before update on public.industry_verticals
for each row execute function public.set_updated_at();
create trigger set_organization_verticals_updated_at
before update on public.organization_verticals
for each row execute function public.set_updated_at();

insert into public.industry_verticals (key, name, description, status, configuration)
values (
  'property_management',
  'Property Management',
  'Launch vertical for property operations, local service providers, technicians, and future residents.',
  'launch',
  '{"route_scope":"/","capability_namespace":"property_management"}'::jsonb
)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  configuration = excluded.configuration;

insert into public.organization_verticals (organization_id, vertical_id, status, is_primary)
select o.id, v.id, 'active', true
from public.organizations o
cross join public.industry_verticals v
where v.key = 'property_management'
on conflict (organization_id, vertical_id) do nothing;

alter table public.industry_verticals enable row level security;
alter table public.organization_verticals enable row level security;

create policy "verticals_read_authenticated"
on public.industry_verticals for select to authenticated using (status in ('launch', 'active') or public.is_super_admin());
create policy "verticals_manage_super_admin"
on public.industry_verticals for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "organization_verticals_read_members"
on public.organization_verticals for select to authenticated using (public.is_organization_member(organization_id) or public.is_super_admin());
create policy "organization_verticals_manage_super_admin"
on public.organization_verticals for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

grant select on public.industry_verticals, public.organization_verticals to authenticated;
grant insert, update, delete on public.industry_verticals, public.organization_verticals to authenticated;

comment on table public.industry_verticals is 'Registry of modular industries served by Optimize Local Connect; Property Management is the launch vertical.';
comment on table public.organization_verticals is 'Organization activation and settings for one or more industry verticals.';

commit;
