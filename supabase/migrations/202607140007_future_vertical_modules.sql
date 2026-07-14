begin;

alter type public.organization_type add value if not exists 'hoa';
alter type public.organization_type add value if not exists 'homeowner';
alter type public.organization_type add value if not exists 'real_estate';
alter type public.organization_type add value if not exists 'local_government';
alter type public.organization_type add value if not exists 'school';
alter type public.organization_type add value if not exists 'healthcare';
alter type public.organization_type add value if not exists 'nonprofit';
alter type public.organization_type add value if not exists 'service_marketplace';

create table public.platform_modules (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null unique,
  layer text not null check (layer in ('core', 'vertical_extension')),
  status text not null default 'planned' check (status in ('active', 'planned', 'paused', 'retired')),
  description text not null,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vertical_modules (
  vertical_id uuid not null references public.industry_verticals(id) on delete cascade,
  module_key text not null references public.platform_modules(key) on delete restrict,
  is_required boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (vertical_id, module_key)
);
create index vertical_modules_module_idx on public.vertical_modules (module_key, vertical_id);

create trigger set_platform_modules_updated_at before update on public.platform_modules for each row execute function public.set_updated_at();
create trigger set_vertical_modules_updated_at before update on public.vertical_modules for each row execute function public.set_updated_at();

insert into public.platform_modules (key, name, layer, status, description)
values
  ('identity', 'Identity', 'core', 'active', 'Shared authentication, profiles, sessions, and invitations.'),
  ('organizations', 'Organizations', 'core', 'active', 'Shared multi-tenant organizations, memberships, roles, and activation context.'),
  ('geography', 'Geography', 'core', 'active', 'Unlimited cities, markets, coverage, and local operating context.'),
  ('provider_marketplace', 'Provider Marketplace', 'core', 'active', 'Verified local provider discovery, relationships, services, and trust signals.'),
  ('requests', 'Requests', 'core', 'active', 'Reusable scoped demand and service-request lifecycle.'),
  ('quotes', 'Quotes', 'core', 'active', 'Reusable provider response, pricing, and selection workflow.'),
  ('work_execution', 'Work Execution', 'core', 'active', 'Assignment, status, completion, and accountable execution records.'),
  ('communications', 'Communications', 'core', 'active', 'Messages, conversations, participants, and shared context.'),
  ('files', 'Files', 'core', 'active', 'Private governed file metadata and attachments.'),
  ('notifications', 'Notifications', 'core', 'active', 'User delivery preferences and multi-channel notification state.'),
  ('analytics', 'Analytics', 'core', 'active', 'Shared event capture, aggregates, audit history, and outbox delivery.'),
  ('optimize_ai', 'Optimize AI', 'core', 'active', 'Provider-agnostic decision optimization, capability routing, and governed AI execution.'),
  ('property_operations', 'Property Operations', 'vertical_extension', 'active', 'Property, unit, appliance, warranty, work-order, and invoice workflows.'),
  ('community_governance', 'Community Governance', 'vertical_extension', 'planned', 'HOA boards, communities, residents, governance, and association workflows.'),
  ('household_services', 'Household Services', 'vertical_extension', 'planned', 'Homeowner property context and household service coordination.'),
  ('transaction_coordination', 'Transaction Coordination', 'vertical_extension', 'planned', 'Realtor transaction milestones and local service coordination.'),
  ('civic_procurement', 'Civic Procurement', 'vertical_extension', 'planned', 'Local-government purchasing, public accountability, and community impact.'),
  ('education_facilities', 'Education Facilities', 'vertical_extension', 'planned', 'School facilities, service operations, and education-community context.'),
  ('healthcare_facilities', 'Healthcare Facilities', 'vertical_extension', 'planned', 'Governed healthcare facility service operations.'),
  ('nonprofit_operations', 'Nonprofit Operations', 'vertical_extension', 'planned', 'Mission-aware resource, service, and partner operations.'),
  ('marketplace_operations', 'Marketplace Operations', 'vertical_extension', 'planned', 'Configurable service-marketplace rules, categories, and transaction context.');

update public.industry_verticals
set configuration = configuration || '{"version":1,"module_key":"property_operations","platform_role":"first_industry_launch"}'::jsonb
where key = 'property_management';

insert into public.industry_verticals (key, name, description, status, configuration)
values
  ('hoas', 'HOAs', 'Community association governance, resident service coordination, and trusted local procurement.', 'planned', '{"version":null,"module_key":"community_governance"}'::jsonb),
  ('homeowners', 'Homeowners', 'Trusted local services and decision support for homeowners and their homes.', 'planned', '{"version":null,"module_key":"household_services"}'::jsonb),
  ('realtors', 'Realtors', 'Local service coordination and decision support around real-estate transactions.', 'planned', '{"version":null,"module_key":"transaction_coordination"}'::jsonb),
  ('local_governments', 'Local Governments', 'Transparent local purchasing, service coordination, and measurable community impact.', 'planned', '{"version":null,"module_key":"civic_procurement"}'::jsonb),
  ('schools', 'Schools', 'Local service networks and accountable operations for education communities.', 'planned', '{"version":null,"module_key":"education_facilities"}'::jsonb),
  ('healthcare', 'Healthcare', 'Governed local service coordination for healthcare facilities and community providers.', 'planned', '{"version":null,"module_key":"healthcare_facilities"}'::jsonb),
  ('nonprofits', 'Nonprofits', 'Resource-efficient operations and local partnerships for mission-driven organizations.', 'planned', '{"version":null,"module_key":"nonprofit_operations"}'::jsonb),
  ('service_marketplaces', 'Service Marketplaces', 'Reusable local marketplace infrastructure for specialized service communities.', 'planned', '{"version":null,"module_key":"marketplace_operations"}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  configuration = public.industry_verticals.configuration || excluded.configuration;

insert into public.vertical_modules (vertical_id, module_key, is_required)
select v.id, m.key, true
from public.industry_verticals v
cross join public.platform_modules m
where m.layer = 'core'
on conflict (vertical_id, module_key) do nothing;

with extension_map(vertical_key, module_key) as (
  values
    ('property_management', 'property_operations'),
    ('hoas', 'community_governance'),
    ('homeowners', 'household_services'),
    ('realtors', 'transaction_coordination'),
    ('local_governments', 'civic_procurement'),
    ('schools', 'education_facilities'),
    ('healthcare', 'healthcare_facilities'),
    ('nonprofits', 'nonprofit_operations'),
    ('service_marketplaces', 'marketplace_operations')
)
insert into public.vertical_modules (vertical_id, module_key, is_required)
select v.id, e.module_key, true
from extension_map e
join public.industry_verticals v on v.key = e.vertical_key
on conflict (vertical_id, module_key) do nothing;

alter table public.platform_modules enable row level security;
alter table public.vertical_modules enable row level security;

create policy "platform_modules_read_authenticated" on public.platform_modules for select to authenticated using (status in ('active','planned') or public.is_super_admin());
create policy "platform_modules_manage_super_admin" on public.platform_modules for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "vertical_modules_read_authenticated" on public.vertical_modules for select to authenticated using (true);
create policy "vertical_modules_manage_super_admin" on public.vertical_modules for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

grant select on public.platform_modules, public.vertical_modules to authenticated;
grant insert, update, delete on public.platform_modules, public.vertical_modules to authenticated;

comment on table public.platform_modules is 'Reusable Optimize Local Connect core services and vertical-specific extension modules.';
comment on table public.vertical_modules is 'Declarative composition of shared and vertical-specific modules for an industry marketplace.';

commit;
