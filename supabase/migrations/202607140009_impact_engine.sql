begin;

create table public.impact_methodologies (
  id uuid primary key default gen_random_uuid(),
  methodology_key text not null check (methodology_key ~ '^[a-z][a-z0-9_]*$'),
  version integer not null check (version > 0),
  name text not null,
  description text not null,
  formula jsonb not null,
  assumptions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (methodology_key, version),
  check (jsonb_typeof(formula)='object'),
  check (jsonb_typeof(assumptions)='object')
);

create table public.impact_metric_definitions (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null unique,
  unit text not null check (unit in ('cents','hours','minutes','count','percent')),
  value_kind text not null check (value_kind in ('measured','estimated','derived')),
  aggregation text not null check (aggregation in ('sum','average','latest','ratio')),
  methodology_key text not null,
  methodology_version integer not null default 1 check (methodology_version>0),
  description text not null,
  is_active boolean not null default true,
  display_order integer not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (methodology_key,methodology_version) references public.impact_methodologies(methodology_key,version) on delete restrict
);

create table public.impact_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  market_id uuid references public.markets(id) on delete restrict,
  city_id uuid references public.cities(id) on delete restrict,
  property_id uuid references public.properties(id) on delete restrict,
  work_order_id uuid references public.work_orders(id) on delete restrict,
  vendor_organization_id uuid references public.vendor_profiles(organization_id) on delete restrict,
  metric_key text not null references public.impact_metric_definitions(key) on delete restrict,
  value numeric(20,4) not null check (value >= 0),
  methodology_key text not null,
  methodology_version integer not null check (methodology_version > 0),
  confidence numeric(5,4) not null default 1 check (confidence between 0 and 1),
  source text not null check (source in ('system','work_order','invoice','user_attested','admin','import','ai_assisted')),
  source_entity_type text,
  source_entity_id uuid,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(metadata)='object'),
  foreign key (methodology_key,methodology_version) references public.impact_methodologies(methodology_key,version) on delete restrict
);
create index impact_observations_org_metric_time_idx on public.impact_observations (organization_id,metric_key,observed_at desc);
create index impact_observations_market_metric_time_idx on public.impact_observations (market_id,metric_key,observed_at desc) where market_id is not null;
create index impact_observations_work_order_idx on public.impact_observations (work_order_id,metric_key) where work_order_id is not null;
create index impact_observations_vendor_idx on public.impact_observations (vendor_organization_id,metric_key,observed_at desc) where vendor_organization_id is not null;

create table public.daily_impact_metrics (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric_date date not null,
  market_id uuid references public.markets(id) on delete cascade,
  estimated_money_saved_cents bigint not null default 0 check (estimated_money_saved_cents>=0),
  estimated_hours_saved numeric(18,4) not null default 0 check (estimated_hours_saved>=0),
  jobs_completed integer not null default 0 check (jobs_completed>=0),
  vendor_response_minutes_sum numeric(18,4) not null default 0 check (vendor_response_minutes_sum>=0),
  vendor_response_count integer not null default 0 check (vendor_response_count>=0),
  emergency_response_minutes_sum numeric(18,4) not null default 0 check (emergency_response_minutes_sum>=0),
  emergency_response_count integer not null default 0 check (emergency_response_count>=0),
  vendor_growth_count integer not null default 0 check (vendor_growth_count>=0),
  local_spending_retained_cents bigint not null default 0 check (local_spending_retained_cents>=0),
  observation_count integer not null default 0 check (observation_count>=0),
  computed_at timestamptz not null default now()
);
create unique index daily_impact_metrics_scope_idx on public.daily_impact_metrics (organization_id,metric_date,coalesce(market_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index daily_impact_metrics_date_idx on public.daily_impact_metrics (metric_date desc,organization_id);
create index daily_impact_metrics_market_idx on public.daily_impact_metrics (market_id,metric_date desc) where market_id is not null;

create table public.impact_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  scope_type text not null check (scope_type in ('platform','organization','market','portfolio','property','vendor')),
  scope_id uuid,
  period_start date not null,
  period_end date not null,
  metrics jsonb not null,
  methodology_versions jsonb not null,
  source_cutoff_at timestamptz not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (period_end>=period_start),
  check (jsonb_typeof(metrics)='object'),
  check (jsonb_typeof(methodology_versions)='object')
);
create index impact_snapshots_org_time_idx on public.impact_snapshots (organization_id,created_at desc);
create index impact_snapshots_scope_idx on public.impact_snapshots (scope_type,scope_id,period_end desc);

create table public.impact_report_requests (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.impact_snapshots(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  provider_connection_id uuid references public.ai_provider_connections(id) on delete set null,
  status public.ai_run_status not null default 'queued',
  question text not null check (char_length(question) between 3 and 2000),
  report_format text not null default 'executive_summary' check (report_format in ('executive_summary','portfolio_review','community_report','city_comparison','structured_json')),
  input_snapshot jsonb not null,
  output jsonb,
  model_reference text,
  prompt_version text,
  error jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at>=started_at)
);
create index impact_report_requests_requester_idx on public.impact_report_requests (requested_by,created_at desc);
create index impact_report_requests_status_idx on public.impact_report_requests (status,created_at) where status in ('queued','running','requires_approval');

do $$ declare table_name text; begin
  foreach table_name in array array['impact_methodologies','impact_metric_definitions','impact_report_requests'] loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',table_name,table_name);
  end loop;
end $$;

insert into public.impact_methodologies (methodology_key,version,name,description,formula,assumptions)
values
('estimated_money_saved',1,'Estimated Money Saved v1','Positive difference between an approved baseline and documented actual cost.','{"formula":"max(baseline_cost_cents - actual_cost_cents, 0)"}','{"currency":"USD","negative_savings_floor":0}'),
('estimated_hours_saved',1,'Estimated Hours Saved v1','Positive difference between a documented baseline effort and actual effort.','{"formula":"max(baseline_hours - actual_hours, 0)"}','{"negative_hours_floor":0}'),
('operational_response',1,'Operational Response v1','Elapsed minutes from request publication to first attributable provider response or emergency acknowledgement.','{"vendor":"first_quote_at - request_published_at","emergency":"acknowledged_at - request_published_at"}','{"minimum_minutes":0}'),
('job_completion',1,'Job Completion v1','One observation for each work order on its first transition to completed.','{"formula":"count(distinct completed_work_order_id)"}','{}'),
('vendor_growth',1,'Vendor Growth v1','One observation when a property organization first activates a provider relationship.','{"formula":"count(distinct activated_vendor_relationship_id)"}','{}'),
('local_spending_retained',1,'Local Spending Retained v1','Documented or policy-estimated portion of completed-work spending retained by eligible local businesses.','{"formula":"documented_local_spend_cents"}','{"requires_source_metadata":true}')
on conflict (methodology_key,version) do nothing;

insert into public.impact_metric_definitions (key,name,unit,value_kind,aggregation,methodology_key,description,display_order)
values
('estimated_money_saved','Estimated Money Saved','cents','estimated','sum','estimated_money_saved','Estimated cost avoided against an approved baseline.',1),
('estimated_hours_saved','Estimated Hours Saved','hours','estimated','sum','estimated_hours_saved','Estimated operational effort avoided against a documented baseline.',2),
('vendor_response_time','Vendor Response Time','minutes','measured','average','operational_response','Elapsed time from request publication to the selected provider response.',3),
('emergency_response_time','Emergency Response Time','minutes','measured','average','operational_response','Elapsed time from emergency publication to acknowledgement.',4),
('jobs_completed','Jobs Completed','count','measured','sum','job_completion','Distinct work orders completed through the platform.',5),
('vendor_growth','Vendor Growth','count','measured','sum','vendor_growth','New active local-provider relationships.',6),
('local_spending_retained','Local Spending Retained','cents','estimated','sum','local_spending_retained','Estimated completed-work spending retained by eligible local businesses.',7),
('average_savings_per_work_order','Average Savings Per Work Order','cents','derived','ratio','estimated_money_saved','Estimated money saved divided by completed jobs.',8),
('community_savings_since_launch','Community Savings Since Launch','cents','derived','sum','estimated_money_saved','Cumulative estimated savings across the selected community scope.',9),
('portfolio_savings','Portfolio Savings','cents','derived','sum','estimated_money_saved','Cumulative estimated savings for a property organization or portfolio.',10)
on conflict (key) do update set name=excluded.name,unit=excluded.unit,value_kind=excluded.value_kind,aggregation=excluded.aggregation,methodology_key=excluded.methodology_key,description=excluded.description,display_order=excluded.display_order,is_active=true;

insert into public.platform_modules (key,name,layer,status,description)
values ('impact_engine','Impact Engine','core','active','Governed community-impact observations, methodologies, rollups, reporting, and AI-ready snapshots.')
on conflict (key) do update set name=excluded.name,layer=excluded.layer,status=excluded.status,description=excluded.description;
insert into public.vertical_modules (vertical_id,module_key,is_required)
select id,'impact_engine',true from public.industry_verticals on conflict (vertical_id,module_key) do nothing;

create or replace function public.prevent_impact_observation_mutation()
returns trigger language plpgsql set search_path='' as $$ begin raise exception 'impact observations are immutable'; end $$;
create trigger impact_observations_immutable before update or delete on public.impact_observations for each row execute function public.prevent_impact_observation_mutation();

create or replace function public.validate_impact_observation()
returns trigger language plpgsql set search_path='' as $$
declare definition public.impact_metric_definitions%rowtype;
begin
  select * into definition from public.impact_metric_definitions where key=new.metric_key and is_active;
  if not found then raise exception 'impact metric is not active'; end if;
  new.methodology_key:=definition.methodology_key;
  if not exists(select 1 from public.impact_methodologies m where m.methodology_key=new.methodology_key and m.version=new.methodology_version and m.is_active) then raise exception 'impact methodology version is not active'; end if;
  if definition.unit in ('cents','count') and trunc(new.value)<>new.value then raise exception 'impact metric requires an integer value'; end if;
  return new;
end $$;
create trigger impact_observations_validate before insert on public.impact_observations for each row execute function public.validate_impact_observation();

create or replace function public.rollup_impact_observation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.daily_impact_metrics (organization_id,metric_date,market_id,estimated_money_saved_cents,estimated_hours_saved,jobs_completed,vendor_response_minutes_sum,vendor_response_count,emergency_response_minutes_sum,emergency_response_count,vendor_growth_count,local_spending_retained_cents,observation_count)
  values (new.organization_id,new.observed_at::date,new.market_id,
    case when new.metric_key='estimated_money_saved' then new.value::bigint else 0 end,
    case when new.metric_key='estimated_hours_saved' then new.value else 0 end,
    case when new.metric_key='jobs_completed' then new.value::integer else 0 end,
    case when new.metric_key='vendor_response_time' then new.value else 0 end,
    case when new.metric_key='vendor_response_time' then 1 else 0 end,
    case when new.metric_key='emergency_response_time' then new.value else 0 end,
    case when new.metric_key='emergency_response_time' then 1 else 0 end,
    case when new.metric_key='vendor_growth' then new.value::integer else 0 end,
    case when new.metric_key='local_spending_retained' then new.value::bigint else 0 end,1)
  on conflict (organization_id,metric_date,(coalesce(market_id,'00000000-0000-0000-0000-000000000000'::uuid))) do update set
    estimated_money_saved_cents=public.daily_impact_metrics.estimated_money_saved_cents+excluded.estimated_money_saved_cents,
    estimated_hours_saved=public.daily_impact_metrics.estimated_hours_saved+excluded.estimated_hours_saved,
    jobs_completed=public.daily_impact_metrics.jobs_completed+excluded.jobs_completed,
    vendor_response_minutes_sum=public.daily_impact_metrics.vendor_response_minutes_sum+excluded.vendor_response_minutes_sum,
    vendor_response_count=public.daily_impact_metrics.vendor_response_count+excluded.vendor_response_count,
    emergency_response_minutes_sum=public.daily_impact_metrics.emergency_response_minutes_sum+excluded.emergency_response_minutes_sum,
    emergency_response_count=public.daily_impact_metrics.emergency_response_count+excluded.emergency_response_count,
    vendor_growth_count=public.daily_impact_metrics.vendor_growth_count+excluded.vendor_growth_count,
    local_spending_retained_cents=public.daily_impact_metrics.local_spending_retained_cents+excluded.local_spending_retained_cents,
    observation_count=public.daily_impact_metrics.observation_count+1,computed_at=now();
  return new;
end $$;
create trigger impact_observations_rollup after insert on public.impact_observations for each row execute function public.rollup_impact_observation();

create or replace function public.capture_completed_work_order_impact()
returns trigger language plpgsql security definer set search_path='' as $$
declare request public.service_requests%rowtype; property public.properties%rowtype; quote_created timestamptz; emergency_ack timestamptz; observed timestamptz;
begin
  if new.status<>'completed' or (tg_op='UPDATE' and old.status='completed') then return new; end if;
  select * into request from public.service_requests where id=new.service_request_id;
  select * into property from public.properties where id=request.property_id;
  observed:=coalesce(new.completed_at,new.actual_end_at,now());
  insert into public.impact_observations (organization_id,market_id,city_id,property_id,work_order_id,vendor_organization_id,metric_key,value,methodology_version,confidence,source,source_entity_type,source_entity_id,idempotency_key,observed_at)
  values (new.property_organization_id,property.market_id,property.city_id,property.id,new.id,new.vendor_organization_id,'jobs_completed',1,1,1,'system','work_order',new.id,'work_order:'||new.id||':jobs_completed:v1',observed)
  on conflict (idempotency_key) do nothing;
  select q.created_at into quote_created from public.quotes q where q.id=new.quote_id and request.published_at is not null;
  if quote_created is not null and quote_created>=request.published_at then
    insert into public.impact_observations (organization_id,market_id,city_id,property_id,work_order_id,vendor_organization_id,metric_key,value,methodology_version,confidence,source,source_entity_type,source_entity_id,idempotency_key,observed_at)
    values (new.property_organization_id,property.market_id,property.city_id,property.id,new.id,new.vendor_organization_id,'vendor_response_time',extract(epoch from (quote_created-request.published_at))/60,1,1,'system','work_order',new.id,'work_order:'||new.id||':vendor_response_time:v1',observed) on conflict (idempotency_key) do nothing;
  end if;
  select er.acknowledged_at into emergency_ack from public.emergency_requests er where er.service_request_id=request.id;
  if emergency_ack is not null and request.published_at is not null and emergency_ack>=request.published_at then
    insert into public.impact_observations (organization_id,market_id,city_id,property_id,work_order_id,vendor_organization_id,metric_key,value,methodology_version,confidence,source,source_entity_type,source_entity_id,idempotency_key,observed_at)
    values (new.property_organization_id,property.market_id,property.city_id,property.id,new.id,new.vendor_organization_id,'emergency_response_time',extract(epoch from (emergency_ack-request.published_at))/60,1,1,'system','work_order',new.id,'work_order:'||new.id||':emergency_response_time:v1',observed) on conflict (idempotency_key) do nothing;
  end if;
  return new;
end $$;
create trigger capture_completed_work_order_impact after insert or update of status on public.work_orders for each row execute function public.capture_completed_work_order_impact();

create or replace function public.capture_vendor_growth_impact()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='active' and (tg_op='INSERT' or old.status<>'active') then
    insert into public.impact_observations (organization_id,vendor_organization_id,metric_key,value,methodology_version,confidence,source,source_entity_type,source_entity_id,idempotency_key,observed_at)
    values (new.property_organization_id,new.vendor_organization_id,'vendor_growth',1,1,1,'system','organization_vendor_relationship',new.id,'vendor_relationship:'||new.id||':activated:v1',coalesce(new.updated_at,new.created_at,now())) on conflict (idempotency_key) do nothing;
  end if;
  return new;
end $$;
create trigger capture_vendor_growth_impact after insert or update of status on public.organization_vendor_relationships for each row execute function public.capture_vendor_growth_impact();

create or replace function public.record_work_order_impact(target_work_order_id uuid,target_baseline_cost_cents bigint,target_actual_cost_cents bigint,target_baseline_hours numeric,target_actual_hours numeric,target_local_spending_retained_cents bigint,target_confidence numeric default 0.8,target_source text default 'user_attested',target_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare work public.work_orders%rowtype; request public.service_requests%rowtype; property public.properties%rowtype; money bigint; hours numeric; actor uuid:=auth.uid(); inserted_count integer;
begin
  select * into work from public.work_orders where id=target_work_order_id for update;
  if not found then raise exception 'work order not found'; end if;
  if not (public.has_organization_role(work.property_organization_id,array['owner','admin','property_manager']::public.membership_role[]) or public.is_super_admin() or coalesce(auth.jwt()->>'role','')='service_role') then raise exception 'work order access denied'; end if;
  if work.status<>'completed' then raise exception 'impact can only be recorded for a completed work order'; end if;
  if target_baseline_cost_cents<0 or target_actual_cost_cents<0 or target_baseline_hours<0 or target_actual_hours<0 or target_local_spending_retained_cents<0 or target_local_spending_retained_cents>target_actual_cost_cents or target_confidence<0 or target_confidence>1 then raise exception 'impact values are invalid'; end if;
  if target_source not in ('invoice','user_attested','admin','import','ai_assisted') then raise exception 'impact source is invalid'; end if;
  select * into request from public.service_requests where id=work.service_request_id;
  select * into property from public.properties where id=request.property_id;
  money:=greatest(target_baseline_cost_cents-target_actual_cost_cents,0);
  hours:=greatest(target_baseline_hours-target_actual_hours,0);
  insert into public.impact_observations (organization_id,market_id,city_id,property_id,work_order_id,vendor_organization_id,metric_key,value,methodology_version,confidence,source,source_entity_type,source_entity_id,idempotency_key,metadata,observed_at,recorded_by)
  values
  (work.property_organization_id,property.market_id,property.city_id,property.id,work.id,work.vendor_organization_id,'estimated_money_saved',money,1,target_confidence,target_source,'work_order',work.id,'work_order:'||work.id||':estimated_money_saved:v1',target_metadata||jsonb_build_object('baseline_cost_cents',target_baseline_cost_cents,'actual_cost_cents',target_actual_cost_cents),coalesce(work.completed_at,work.actual_end_at,now()),actor),
  (work.property_organization_id,property.market_id,property.city_id,property.id,work.id,work.vendor_organization_id,'estimated_hours_saved',hours,1,target_confidence,target_source,'work_order',work.id,'work_order:'||work.id||':estimated_hours_saved:v1',target_metadata||jsonb_build_object('baseline_hours',target_baseline_hours,'actual_hours',target_actual_hours),coalesce(work.completed_at,work.actual_end_at,now()),actor),
  (work.property_organization_id,property.market_id,property.city_id,property.id,work.id,work.vendor_organization_id,'local_spending_retained',target_local_spending_retained_cents,1,target_confidence,target_source,'work_order',work.id,'work_order:'||work.id||':local_spending_retained:v1',target_metadata,coalesce(work.completed_at,work.actual_end_at,now()),actor)
  on conflict (idempotency_key) do nothing;
  get diagnostics inserted_count=row_count;
  if inserted_count>0 then
    insert into public.audit_events (organization_id,actor_user_id,action,entity_type,entity_id,metadata) values (work.property_organization_id,actor,'impact.work_order_recorded','work_order',work.id,jsonb_build_object('estimated_money_saved_cents',money,'estimated_hours_saved',hours,'confidence',target_confidence));
    insert into public.outbox_events (organization_id,topic,payload) values (work.property_organization_id,'impact.work_order_recorded',jsonb_build_object('work_order_id',work.id));
  end if;
  return jsonb_build_object('estimated_money_saved_cents',money,'estimated_hours_saved',hours,'local_spending_retained_cents',target_local_spending_retained_cents);
end $$;

create or replace function public.get_organization_impact_summary(target_organization_id uuid,target_start_date date default null,target_end_date date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not (public.is_organization_member(target_organization_id) or public.is_super_admin()) then raise exception 'organization access denied'; end if;
  select jsonb_build_object(
    'estimated_money_saved_cents',coalesce(sum(d.estimated_money_saved_cents),0),
    'estimated_hours_saved',coalesce(sum(d.estimated_hours_saved),0),
    'average_savings_per_work_order_cents',case when coalesce(sum(d.jobs_completed),0)>0 then round(sum(d.estimated_money_saved_cents)::numeric/sum(d.jobs_completed)) else 0 end,
    'vendor_response_minutes',case when coalesce(sum(d.vendor_response_count),0)>0 then round(sum(d.vendor_response_minutes_sum)/sum(d.vendor_response_count),2) else null end,
    'emergency_response_minutes',case when coalesce(sum(d.emergency_response_count),0)>0 then round(sum(d.emergency_response_minutes_sum)/sum(d.emergency_response_count),2) else null end,
    'jobs_completed',coalesce(sum(d.jobs_completed),0),
    'vendor_growth',coalesce(sum(d.vendor_growth_count),0),
    'local_spending_retained_cents',coalesce(sum(d.local_spending_retained_cents),0),
    'portfolio_savings_cents',coalesce(sum(d.estimated_money_saved_cents),0),
    'community_savings_since_launch_cents',(select coalesce(sum(all_time.estimated_money_saved_cents),0) from public.daily_impact_metrics all_time where all_time.organization_id=target_organization_id),
    'observation_count',coalesce(sum(d.observation_count),0),
    'period_start',target_start_date,'period_end',target_end_date,'generated_at',now()
  ) into result from public.daily_impact_metrics d where d.organization_id=target_organization_id and (target_start_date is null or d.metric_date>=target_start_date) and (target_end_date is null or d.metric_date<=target_end_date);
  return result;
end $$;

create or replace function public.get_platform_impact_summary(target_start_date date default null,target_end_date date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.is_super_admin() then raise exception 'super admin required'; end if;
  select jsonb_build_object('estimated_money_saved_cents',coalesce(sum(estimated_money_saved_cents),0),'estimated_hours_saved',coalesce(sum(estimated_hours_saved),0),'average_savings_per_work_order_cents',case when coalesce(sum(jobs_completed),0)>0 then round(sum(estimated_money_saved_cents)::numeric/sum(jobs_completed)) else 0 end,'vendor_response_minutes',case when coalesce(sum(vendor_response_count),0)>0 then round(sum(vendor_response_minutes_sum)/sum(vendor_response_count),2) else null end,'emergency_response_minutes',case when coalesce(sum(emergency_response_count),0)>0 then round(sum(emergency_response_minutes_sum)/sum(emergency_response_count),2) else null end,'community_savings_since_launch_cents',(select coalesce(sum(estimated_money_saved_cents),0) from public.daily_impact_metrics),'jobs_completed',coalesce(sum(jobs_completed),0),'vendor_growth',coalesce(sum(vendor_growth_count),0),'local_spending_retained_cents',coalesce(sum(local_spending_retained_cents),0),'organization_count',count(distinct organization_id),'generated_at',now()) into result
  from public.daily_impact_metrics where (target_start_date is null or metric_date>=target_start_date) and (target_end_date is null or metric_date<=target_end_date);
  return result;
end $$;

create or replace function public.get_impact_timeseries(target_organization_id uuid,target_start_date date,target_end_date date)
returns table(metric_date date,estimated_money_saved_cents bigint,estimated_hours_saved numeric,jobs_completed bigint,local_spending_retained_cents bigint) language plpgsql stable security definer set search_path='' as $$
begin
  if not ((target_organization_id is not null and public.is_organization_member(target_organization_id)) or public.is_super_admin()) then raise exception 'impact access denied'; end if;
  return query select d.metric_date,sum(d.estimated_money_saved_cents)::bigint,sum(d.estimated_hours_saved),sum(d.jobs_completed)::bigint,sum(d.local_spending_retained_cents)::bigint from public.daily_impact_metrics d where (target_organization_id is null or d.organization_id=target_organization_id) and d.metric_date between target_start_date and target_end_date group by d.metric_date order by d.metric_date;
end $$;

create or replace function public.create_impact_snapshot(target_organization_id uuid,target_start_date date,target_end_date date,target_scope_type text default 'organization',target_scope_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare snapshot_id uuid; summary jsonb; versions jsonb;
begin
  if target_start_date is null or target_end_date is null or target_end_date<target_start_date then raise exception 'invalid snapshot period'; end if;
  if target_organization_id is null then
    if not public.is_super_admin() or target_scope_type<>'platform' then raise exception 'platform snapshot access denied'; end if;
    summary:=public.get_platform_impact_summary(target_start_date,target_end_date);
  else
    if not (public.has_organization_role(target_organization_id,array['owner','admin','property_manager']::public.membership_role[]) or public.is_super_admin()) then raise exception 'snapshot access denied'; end if;
    summary:=public.get_organization_impact_summary(target_organization_id,target_start_date,target_end_date);
  end if;
  select jsonb_object_agg(methodology_key,max_version) into versions from (select methodology_key,max(version) max_version from public.impact_methodologies where is_active group by methodology_key) v;
  insert into public.impact_snapshots (organization_id,scope_type,scope_id,period_start,period_end,metrics,methodology_versions,source_cutoff_at,created_by)
  values (target_organization_id,target_scope_type,coalesce(target_scope_id,target_organization_id),target_start_date,target_end_date,summary,coalesce(versions,'{}'::jsonb),now(),auth.uid()) returning id into snapshot_id;
  return snapshot_id;
end $$;

insert into public.impact_observations (organization_id,market_id,city_id,property_id,work_order_id,vendor_organization_id,metric_key,value,methodology_version,confidence,source,source_entity_type,source_entity_id,idempotency_key,observed_at)
select wo.property_organization_id,p.market_id,p.city_id,p.id,wo.id,wo.vendor_organization_id,'jobs_completed',1,1,1,'system','work_order',wo.id,'work_order:'||wo.id||':jobs_completed:v1',coalesce(wo.completed_at,wo.actual_end_at,wo.updated_at)
from public.work_orders wo join public.service_requests sr on sr.id=wo.service_request_id join public.properties p on p.id=sr.property_id where wo.status='completed' on conflict (idempotency_key) do nothing;
insert into public.impact_observations (organization_id,vendor_organization_id,metric_key,value,methodology_version,confidence,source,source_entity_type,source_entity_id,idempotency_key,observed_at)
select r.property_organization_id,r.vendor_organization_id,'vendor_growth',1,1,1,'system','organization_vendor_relationship',r.id,'vendor_relationship:'||r.id||':activated:v1',r.updated_at from public.organization_vendor_relationships r where r.status='active' on conflict (idempotency_key) do nothing;

alter table public.impact_methodologies enable row level security;
alter table public.impact_metric_definitions enable row level security;
alter table public.impact_observations enable row level security;
alter table public.daily_impact_metrics enable row level security;
alter table public.impact_snapshots enable row level security;
alter table public.impact_report_requests enable row level security;

create policy "impact_methodologies_read" on public.impact_methodologies for select to authenticated using (is_active or public.is_super_admin());
create policy "impact_methodologies_admin" on public.impact_methodologies for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "impact_metrics_read" on public.impact_metric_definitions for select to authenticated using (is_active or public.is_super_admin());
create policy "impact_metrics_admin" on public.impact_metric_definitions for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "impact_observations_read" on public.impact_observations for select to authenticated using (public.is_organization_member(organization_id) or public.is_super_admin());
create policy "daily_impact_read" on public.daily_impact_metrics for select to authenticated using (public.is_organization_member(organization_id) or public.is_super_admin());
create policy "impact_snapshots_read" on public.impact_snapshots for select to authenticated using ((organization_id is not null and public.is_organization_member(organization_id)) or public.is_super_admin());
create policy "impact_reports_read" on public.impact_report_requests for select to authenticated using (requested_by=auth.uid() or public.is_super_admin());
create policy "impact_reports_create" on public.impact_report_requests for insert to authenticated with check (requested_by=auth.uid() and exists(select 1 from public.impact_snapshots s where s.id=snapshot_id and ((s.organization_id is not null and public.is_organization_member(s.organization_id)) or public.is_super_admin())));
create policy "impact_reports_admin" on public.impact_report_requests for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

grant select on public.impact_methodologies,public.impact_metric_definitions,public.impact_observations,public.daily_impact_metrics,public.impact_snapshots,public.impact_report_requests to authenticated;
grant insert on public.impact_report_requests to authenticated;
grant insert,update,delete on public.impact_methodologies,public.impact_metric_definitions to authenticated;
grant all on public.impact_methodologies,public.impact_metric_definitions,public.impact_observations,public.daily_impact_metrics,public.impact_snapshots,public.impact_report_requests to service_role;
grant execute on function public.record_work_order_impact(uuid,bigint,bigint,numeric,numeric,bigint,numeric,text,jsonb) to authenticated,service_role;
grant execute on function public.get_organization_impact_summary(uuid,date,date) to authenticated;
grant execute on function public.get_platform_impact_summary(date,date) to authenticated;
grant execute on function public.get_impact_timeseries(uuid,date,date) to authenticated;
grant execute on function public.create_impact_snapshot(uuid,date,date,text,uuid) to authenticated;

comment on table public.impact_methodologies is 'Versioned, auditable formulas and assumptions for Optimize Local Impact Engine metrics.';
comment on table public.impact_metric_definitions is 'Reusable cross-vertical impact metric catalog distinguishing measured, estimated, and derived values.';
comment on table public.impact_observations is 'Immutable impact source ledger with methodology, confidence, provenance, and idempotency.';
comment on table public.daily_impact_metrics is 'Transactionally maintained daily impact rollups for fast tenant, market, and platform reporting.';
comment on table public.impact_snapshots is 'Point-in-time reproducible impact summaries used by exports and future provider-neutral AI reporting.';
comment on table public.impact_report_requests is 'Provider-neutral AI reporting queue linked to a governed impact snapshot.';

commit;
