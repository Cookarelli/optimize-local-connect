begin;

create table public.ai_capabilities (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null unique,
  category text not null check (category in ('reasoning', 'modality', 'action')),
  status text not null default 'planned' check (status in ('active', 'planned', 'paused', 'retired')),
  supported_input_modalities text[] not null default array['structured_data']::text[],
  supported_output_modalities text[] not null default array['structured_data']::text[],
  requires_human_approval boolean not null default false,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (supported_input_modalities <@ array['text','voice','image','document','structured_data']::text[]),
  check (supported_output_modalities <@ array['text','voice','image','document','structured_data']::text[])
);

create table public.ai_provider_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  connection_key text not null check (connection_key ~ '^[a-z][a-z0-9_]*$'),
  adapter_key text not null check (adapter_key ~ '^[a-z][a-z0-9_.-]*$'),
  display_name text not null,
  secret_reference text not null,
  status text not null default 'inactive' check (status in ('active', 'inactive', 'degraded', 'disabled')),
  priority smallint not null default 100 check (priority between 0 and 1000),
  configuration jsonb not null default '{}'::jsonb,
  health_status text not null default 'unknown' check (health_status in ('unknown', 'healthy', 'degraded', 'unavailable')),
  last_health_check_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ai_provider_connections_scope_key_idx
on public.ai_provider_connections (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), connection_key);
create index ai_provider_connections_routing_idx
on public.ai_provider_connections (status, priority, health_status)
where status = 'active';

create table public.ai_provider_capabilities (
  provider_connection_id uuid not null references public.ai_provider_connections(id) on delete cascade,
  capability_key text not null references public.ai_capabilities(key) on delete restrict,
  model_reference text not null,
  priority smallint not null default 100 check (priority between 0 and 1000),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider_connection_id, capability_key, model_reference)
);
create index ai_provider_capabilities_route_idx
on public.ai_provider_capabilities (capability_key, priority, provider_connection_id);

alter table public.ai_conversations
  add column provider_connection_id uuid references public.ai_provider_connections(id) on delete set null,
  add column capability_key text references public.ai_capabilities(key) on delete set null;
alter table public.ai_messages
  add column provider_connection_id uuid references public.ai_provider_connections(id) on delete set null,
  add column model_reference text;
alter table public.ai_tool_runs
  add column capability_key text references public.ai_capabilities(key) on delete set null;
create index ai_conversations_capability_idx on public.ai_conversations (capability_key, updated_at desc) where capability_key is not null;
create index ai_messages_provider_idx on public.ai_messages (provider_connection_id, created_at desc) where provider_connection_id is not null;
create index ai_tool_runs_capability_status_idx on public.ai_tool_runs (capability_key, status, created_at) where capability_key is not null;

create table public.ai_optimization_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  vertical_id uuid references public.industry_verticals(id) on delete restrict,
  policy_key text not null check (policy_key ~ '^[a-z][a-z0-9_]*$'),
  version integer not null check (version > 0),
  name text not null,
  objective text not null check (objective ~ '^[a-z][a-z0-9_]*$'),
  weights jsonb not null,
  constraints jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(weights) = 'object'),
  check (jsonb_typeof(constraints) = 'object')
);

create unique index ai_optimization_policies_scope_version_idx
on public.ai_optimization_policies (
  coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(vertical_id, '00000000-0000-0000-0000-000000000000'::uuid),
  policy_key,
  version
);
create unique index ai_optimization_policies_one_active_idx
on public.ai_optimization_policies (
  coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(vertical_id, '00000000-0000-0000-0000-000000000000'::uuid),
  policy_key
) where is_active;

create table public.ai_optimization_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  policy_id uuid references public.ai_optimization_policies(id) on delete set null,
  ai_conversation_id uuid references public.ai_conversations(id) on delete set null,
  provider_connection_id uuid references public.ai_provider_connections(id) on delete set null,
  objective text not null check (objective ~ '^[a-z][a-z0-9_]*$'),
  capability_key text not null references public.ai_capabilities(key) on delete restrict,
  context_type text,
  context_id uuid,
  status public.ai_run_status not null default 'queued',
  input_snapshot jsonb not null,
  policy_snapshot jsonb not null,
  selected_entity_type text,
  selected_entity_id uuid,
  decision_score numeric(7,4) check (decision_score is null or decision_score between 0 and 100),
  confidence numeric(6,5) check (confidence is null or confidence between 0 and 1),
  explanation jsonb,
  model_reference text,
  prompt_version text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);
create index ai_optimization_runs_org_time_idx on public.ai_optimization_runs (organization_id, requested_at desc);
create index ai_optimization_runs_requester_idx on public.ai_optimization_runs (requested_by, requested_at desc);
create index ai_optimization_runs_status_idx on public.ai_optimization_runs (status, requested_at) where status in ('queued', 'running', 'requires_approval');
create index ai_optimization_runs_context_idx on public.ai_optimization_runs (context_type, context_id) where context_id is not null;

create table public.ai_optimization_candidates (
  id uuid primary key default gen_random_uuid(),
  optimization_run_id uuid not null references public.ai_optimization_runs(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  label text,
  rank integer not null check (rank > 0),
  composite_score numeric(7,4) not null check (composite_score between 0 and 100),
  raw_metrics jsonb not null,
  normalized_metrics jsonb not null,
  contributions jsonb not null,
  is_eligible boolean not null default true,
  exclusion_reasons text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  unique (optimization_run_id, entity_type, entity_id),
  unique (optimization_run_id, rank)
);
create index ai_optimization_candidates_entity_idx on public.ai_optimization_candidates (entity_type, entity_id, created_at desc);

create table public.ai_run_inputs (
  id uuid primary key default gen_random_uuid(),
  optimization_run_id uuid not null references public.ai_optimization_runs(id) on delete cascade,
  modality text not null check (modality in ('text', 'voice', 'image', 'document', 'structured_data')),
  file_id uuid references public.files(id) on delete restrict,
  content jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (file_id is not null or content <> '{}'::jsonb)
);
create index ai_run_inputs_run_idx on public.ai_run_inputs (optimization_run_id, created_at);
create index ai_run_inputs_file_idx on public.ai_run_inputs (file_id) where file_id is not null;

create trigger set_ai_capabilities_updated_at before update on public.ai_capabilities for each row execute function public.set_updated_at();
create trigger set_ai_provider_connections_updated_at before update on public.ai_provider_connections for each row execute function public.set_updated_at();
create trigger set_ai_provider_capabilities_updated_at before update on public.ai_provider_capabilities for each row execute function public.set_updated_at();
create trigger set_ai_optimization_policies_updated_at before update on public.ai_optimization_policies for each row execute function public.set_updated_at();
create trigger set_ai_optimization_runs_updated_at before update on public.ai_optimization_runs for each row execute function public.set_updated_at();

insert into public.ai_capabilities (key, name, category, status, supported_input_modalities, supported_output_modalities, requires_human_approval, description)
values
  ('decision_optimization', 'Decision Optimization', 'reasoning', 'active', array['structured_data'], array['structured_data','text'], false, 'Ranks eligible choices against a versioned, explainable optimization policy.'),
  ('vendor_ranking', 'Vendor Ranking', 'reasoning', 'active', array['structured_data'], array['structured_data','text'], false, 'Selects the best local provider using value, response, travel, Optimize Score, skill match, and estimated cost.'),
  ('voice', 'Voice', 'modality', 'planned', array['voice'], array['text','voice','structured_data'], false, 'Accepts and returns voice interactions through a configured provider adapter.'),
  ('image_understanding', 'Image Understanding', 'modality', 'planned', array['image'], array['text','structured_data'], false, 'Extracts decision context from images through a configured provider adapter.'),
  ('document_understanding', 'Document Understanding', 'modality', 'planned', array['document'], array['text','structured_data'], false, 'Extracts governed decision context from documents through a configured provider adapter.'),
  ('scheduling', 'Scheduling', 'action', 'planned', array['text','structured_data'], array['structured_data'], true, 'Proposes or performs scheduling actions with policy-based human approval.'),
  ('vendor_routing', 'Vendor Routing', 'action', 'planned', array['structured_data'], array['structured_data'], true, 'Routes work to an eligible local provider after authorization and approval checks.');

insert into public.ai_optimization_policies (vertical_id, policy_key, version, name, objective, weights, constraints)
select
  id,
  'property_management_vendor_selection',
  1,
  'Property Management Vendor Selection',
  'best_vendor',
  '{"best_value":0.22,"fastest_response":0.16,"shortest_travel":0.10,"highest_optimize_score":0.20,"best_skill_match":0.22,"lowest_estimated_cost":0.10}'::jsonb,
  '{"requires_verified_eligibility":true,"decision_mode":"explainable_weighted_rank"}'::jsonb
from public.industry_verticals
where key = 'property_management';

create or replace function public.can_access_ai_optimization_run(target_run_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ai_optimization_runs r
    where r.id = target_run_id
      and (
        r.requested_by = auth.uid()
        or public.has_organization_role(r.organization_id, array['owner','admin']::public.membership_role[])
        or public.is_super_admin()
      )
  );
$$;

create or replace function public.record_optimize_ai_decision(
  target_organization_id uuid,
  target_policy_key text,
  target_policy_version integer,
  target_context_type text,
  target_context_id uuid,
  target_input_snapshot jsonb,
  ranked_candidates jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  selected_policy public.ai_optimization_policies%rowtype;
  selected_candidate jsonb;
  new_run_id uuid;
begin
  if auth.uid() is null or not public.is_organization_member(target_organization_id) then
    raise exception 'organization access denied';
  end if;
  if jsonb_typeof(ranked_candidates) <> 'array' or jsonb_array_length(ranked_candidates) = 0 then
    raise exception 'ranked candidates are required';
  end if;

  select p.* into selected_policy
  from public.ai_optimization_policies p
  where p.policy_key = target_policy_key
    and p.version = target_policy_version
    and p.is_active
    and (p.organization_id = target_organization_id or p.organization_id is null)
  order by (p.organization_id is not null) desc
  limit 1;
  if not found then raise exception 'optimization policy not found'; end if;

  select value into selected_candidate
  from jsonb_array_elements(ranked_candidates)
  where (value ->> 'rank')::integer = 1
  limit 1;
  if selected_candidate is null then raise exception 'ranked candidates must include rank 1'; end if;

  insert into public.ai_optimization_runs (
    organization_id, requested_by, policy_id, objective, capability_key,
    context_type, context_id, status, input_snapshot, policy_snapshot,
    selected_entity_type, selected_entity_id, decision_score, confidence,
    explanation, started_at, completed_at
  ) values (
    target_organization_id, auth.uid(), selected_policy.id, selected_policy.objective, 'vendor_ranking',
    target_context_type, target_context_id, 'succeeded', target_input_snapshot,
    jsonb_build_object('policy_key', selected_policy.policy_key, 'version', selected_policy.version, 'weights', selected_policy.weights, 'constraints', selected_policy.constraints),
    selected_candidate ->> 'entity_type', (selected_candidate ->> 'entity_id')::uuid,
    (selected_candidate ->> 'score')::numeric, least(1, greatest(0, (selected_candidate ->> 'score')::numeric / 100)),
    jsonb_build_object('contributions', selected_candidate -> 'contributions'), now(), now()
  ) returning id into new_run_id;

  insert into public.ai_optimization_candidates (
    optimization_run_id, entity_type, entity_id, label, rank, composite_score,
    raw_metrics, normalized_metrics, contributions
  )
  select
    new_run_id,
    item ->> 'entity_type',
    (item ->> 'entity_id')::uuid,
    nullif(item ->> 'label', ''),
    (item ->> 'rank')::integer,
    (item ->> 'score')::numeric,
    item -> 'metrics',
    coalesce(item -> 'normalized_metrics', '{}'::jsonb),
    item -> 'contributions'
  from jsonb_array_elements(ranked_candidates) as item;

  insert into public.audit_events (organization_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (target_organization_id, auth.uid(), 'optimize_ai.decision_completed', 'ai_optimization_run', new_run_id, jsonb_build_object('policy_key', target_policy_key, 'policy_version', target_policy_version));
  insert into public.outbox_events (organization_id, topic, payload)
  values (target_organization_id, 'optimize_ai.decision_completed', jsonb_build_object('optimization_run_id', new_run_id, 'objective', selected_policy.objective));

  return new_run_id;
end;
$$;

alter table public.ai_capabilities enable row level security;
alter table public.ai_provider_connections enable row level security;
alter table public.ai_provider_capabilities enable row level security;
alter table public.ai_optimization_policies enable row level security;
alter table public.ai_optimization_runs enable row level security;
alter table public.ai_optimization_candidates enable row level security;
alter table public.ai_run_inputs enable row level security;

create policy "ai_capabilities_read_authenticated" on public.ai_capabilities for select to authenticated using (status in ('active','planned') or public.is_super_admin());
create policy "ai_capabilities_manage_super_admin" on public.ai_capabilities for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "ai_provider_connections_manage_scope" on public.ai_provider_connections for all to authenticated using (
  public.is_super_admin() or (organization_id is not null and public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[]))
) with check (
  public.is_super_admin() or (organization_id is not null and public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[]))
);
create policy "ai_provider_capabilities_manage_scope" on public.ai_provider_capabilities for all to authenticated using (
  exists (select 1 from public.ai_provider_connections c where c.id = provider_connection_id and (public.is_super_admin() or (c.organization_id is not null and public.has_organization_role(c.organization_id, array['owner','admin']::public.membership_role[]))))
) with check (
  exists (select 1 from public.ai_provider_connections c where c.id = provider_connection_id and (public.is_super_admin() or (c.organization_id is not null and public.has_organization_role(c.organization_id, array['owner','admin']::public.membership_role[]))))
);

create policy "ai_optimization_policies_read_scope" on public.ai_optimization_policies for select to authenticated using (
  organization_id is null or public.is_organization_member(organization_id) or public.is_super_admin()
);
create policy "ai_optimization_policies_manage_scope" on public.ai_optimization_policies for all to authenticated using (
  (organization_id is null and public.is_super_admin()) or (organization_id is not null and public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[]))
) with check (
  (organization_id is null and public.is_super_admin()) or (organization_id is not null and public.has_organization_role(organization_id, array['owner','admin']::public.membership_role[]))
);

create policy "ai_optimization_runs_read_scope" on public.ai_optimization_runs for select to authenticated using (public.can_access_ai_optimization_run(id));
create policy "ai_optimization_candidates_read_scope" on public.ai_optimization_candidates for select to authenticated using (public.can_access_ai_optimization_run(optimization_run_id));
create policy "ai_run_inputs_read_scope" on public.ai_run_inputs for select to authenticated using (public.can_access_ai_optimization_run(optimization_run_id));
create policy "ai_run_inputs_create_owner" on public.ai_run_inputs for insert to authenticated with check (
  exists (select 1 from public.ai_optimization_runs r where r.id = optimization_run_id and r.requested_by = auth.uid() and r.status in ('queued','running'))
);

grant select on public.ai_capabilities, public.ai_optimization_policies, public.ai_optimization_runs, public.ai_optimization_candidates, public.ai_run_inputs to authenticated;
grant select, insert, update, delete on public.ai_provider_connections, public.ai_provider_capabilities to authenticated;
grant insert on public.ai_run_inputs to authenticated;
grant execute on function public.record_optimize_ai_decision(uuid, text, integer, text, uuid, jsonb, jsonb) to authenticated;

comment on table public.ai_capabilities is 'Optimize AI capability catalog independent of any model provider.';
comment on table public.ai_provider_connections is 'Configured AI provider adapter connection; contains only a secret reference, never raw credentials.';
comment on table public.ai_provider_capabilities is 'Capability and model routing metadata for a provider connection.';
comment on table public.ai_optimization_policies is 'Versioned, explainable decision policy with organization and vertical scope.';
comment on table public.ai_optimization_runs is 'Auditable Optimize AI decision execution with policy, provider, model, selection, and provenance snapshots.';
comment on table public.ai_optimization_candidates is 'Ranked candidates and per-criterion contributions for an Optimize AI decision.';
comment on table public.ai_run_inputs is 'Text, structured, voice, image, or document input metadata for an Optimize AI run.';
comment on column public.ai_conversations.provider_connection_id is 'Provider-neutral adapter connection used for this Optimize AI conversation, when applicable.';
comment on column public.ai_conversations.model_provider is 'Legacy free-text provenance retained for compatibility; new integrations use provider_connection_id.';
comment on column public.ai_messages.model_reference is 'Provider-neutral model or deployment reference returned by the selected adapter.';

commit;
