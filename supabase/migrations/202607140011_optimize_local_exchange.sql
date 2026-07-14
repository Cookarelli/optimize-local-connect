begin;

insert into public.platform_modules(key,name,layer,status,description,configuration)
values('optimize_local_exchange','Optimize Local Exchange','core','planned','Capacity-aware business service exchange, governed trade history, ratings, AI matching, and future trade credits.','{"target_version":3,"ui_exposed":false,"positioning":"unused_capacity_has_value"}'::jsonb)
on conflict(key) do update set name=excluded.name,layer=excluded.layer,status=excluded.status,description=excluded.description,configuration=excluded.configuration;

insert into public.vertical_modules(vertical_id,module_key,is_required,settings)
select id,'optimize_local_exchange',false,'{"enabled":false,"target_version":3}'::jsonb from public.industry_verticals
on conflict(vertical_id,module_key) do update set is_required=false,settings=excluded.settings;

create table public.exchange_business_profiles(
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  open_to_trade boolean not null default false,
  capacity_summary text check(capacity_summary is null or char_length(capacity_summary)<=1200),
  preferred_exchange_terms text check(preferred_exchange_terms is null or char_length(preferred_exchange_terms)<=1200),
  maximum_travel_minutes integer check(maximum_travel_minutes is null or maximum_travel_minutes between 0 and 1440),
  minimum_estimated_value_cents integer check(minimum_estimated_value_cents is null or minimum_estimated_value_cents>=0),
  auto_match_enabled boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  opened_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((open_to_trade and opened_at is not null and paused_at is null) or (not open_to_trade))
);

create table public.exchange_business_needs(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.exchange_business_profiles(organization_id) on delete cascade,
  vertical_id uuid references public.industry_verticals(id) on delete restrict,
  vendor_category_id uuid references public.vendor_categories(id) on delete set null,
  vendor_service_id uuid references public.vendor_services(id) on delete set null,
  title text not null check(char_length(title) between 3 and 160),
  description text not null check(char_length(description) between 10 and 5000),
  city_id uuid references public.cities(id) on delete set null,
  desired_by date,
  recurrence text check(recurrence is null or recurrence in ('one_time','weekly','monthly','quarterly','seasonal','ongoing')),
  estimated_value_cents integer check(estimated_value_cents is null or estimated_value_cents>=0),
  status text not null default 'draft' check(status in ('draft','published','matched','fulfilled','paused','withdrawn','expired')),
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(expires_at is null or expires_at>coalesce(published_at,created_at)),
  check(status<>'published' or published_at is not null)
);
create index exchange_needs_discovery_idx on public.exchange_business_needs(city_id,vendor_category_id,status,expires_at) where status='published';
create index exchange_needs_org_idx on public.exchange_business_needs(organization_id,status,created_at desc);

create table public.exchange_business_offers(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.exchange_business_profiles(organization_id) on delete cascade,
  vertical_id uuid references public.industry_verticals(id) on delete restrict,
  vendor_category_id uuid references public.vendor_categories(id) on delete set null,
  vendor_service_id uuid references public.vendor_services(id) on delete set null,
  title text not null check(char_length(title) between 3 and 160),
  description text not null check(char_length(description) between 10 and 5000),
  city_id uuid references public.cities(id) on delete set null,
  available_capacity text check(available_capacity is null or char_length(available_capacity)<=500),
  availability_start date,
  availability_end date,
  estimated_value_cents integer check(estimated_value_cents is null or estimated_value_cents>=0),
  status text not null default 'draft' check(status in ('draft','published','matched','paused','withdrawn','expired')),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(availability_end is null or availability_start is null or availability_end>=availability_start),
  check(status<>'published' or published_at is not null)
);
create index exchange_offers_discovery_idx on public.exchange_business_offers(city_id,vendor_category_id,status,availability_end) where status='published';
create index exchange_offers_org_idx on public.exchange_business_offers(organization_id,status,created_at desc);

create table public.exchange_trade_requests(
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  requesting_organization_id uuid not null references public.exchange_business_profiles(organization_id) on delete restrict,
  target_organization_id uuid references public.exchange_business_profiles(organization_id) on delete restrict,
  business_need_id uuid references public.exchange_business_needs(id) on delete set null,
  title text not null check(char_length(title) between 3 and 180),
  description text not null check(char_length(description) between 10 and 5000),
  desired_by date,
  estimated_requested_value_cents integer check(estimated_requested_value_cents is null or estimated_requested_value_cents>=0),
  status text not null default 'draft' check(status in ('draft','open','negotiating','accepted','declined','cancelled','expired','completed')),
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(target_organization_id is null or target_organization_id<>requesting_organization_id),
  check(status<>'open' or published_at is not null),
  check(expires_at is null or expires_at>coalesce(published_at,created_at))
);
create index exchange_trade_requests_open_idx on public.exchange_trade_requests(status,expires_at,published_at desc) where status in('open','negotiating');
create index exchange_trade_requests_requester_idx on public.exchange_trade_requests(requesting_organization_id,status,created_at desc);
create index exchange_trade_requests_target_idx on public.exchange_trade_requests(target_organization_id,status,created_at desc) where target_organization_id is not null;

create table public.exchange_trade_proposals(
  id uuid primary key default gen_random_uuid(),
  trade_request_id uuid not null references public.exchange_trade_requests(id) on delete cascade,
  proposing_organization_id uuid not null references public.exchange_business_profiles(organization_id) on delete restrict,
  proposal_number integer not null check(proposal_number>0),
  message text check(message is null or char_length(message)<=5000),
  status text not null default 'draft' check(status in ('draft','submitted','countered','accepted','declined','withdrawn','expired')),
  valid_until timestamptz,
  submitted_at timestamptz,
  responded_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(trade_request_id,proposing_organization_id,proposal_number),
  check(status<>'submitted' or submitted_at is not null),
  check(valid_until is null or valid_until>coalesce(submitted_at,created_at))
);
create index exchange_trade_proposals_request_idx on public.exchange_trade_proposals(trade_request_id,status,submitted_at desc);
create index exchange_trade_proposals_proposer_idx on public.exchange_trade_proposals(proposing_organization_id,status,created_at desc);

create table public.exchange_proposal_items(
  id uuid primary key default gen_random_uuid(),
  trade_proposal_id uuid not null references public.exchange_trade_proposals(id) on delete cascade,
  direction text not null check(direction in ('offered','requested')),
  business_offer_id uuid references public.exchange_business_offers(id) on delete set null,
  business_need_id uuid references public.exchange_business_needs(id) on delete set null,
  description text not null check(char_length(description) between 3 and 2000),
  quantity numeric(12,3) check(quantity is null or quantity>0),
  unit text check(unit is null or char_length(unit)<=40),
  estimated_value_cents integer check(estimated_value_cents is null or estimated_value_cents>=0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check(business_offer_id is null or business_need_id is null)
);
create index exchange_proposal_items_proposal_idx on public.exchange_proposal_items(trade_proposal_id,direction,sort_order);

create table public.exchange_trades(
  id uuid primary key default gen_random_uuid(),
  trade_number bigint generated always as identity unique,
  trade_request_id uuid not null unique references public.exchange_trade_requests(id) on delete restrict,
  accepted_proposal_id uuid not null unique references public.exchange_trade_proposals(id) on delete restrict,
  requesting_organization_id uuid not null references public.organizations(id) on delete restrict,
  fulfilling_organization_id uuid not null references public.organizations(id) on delete restrict,
  status text not null default 'agreed' check(status in ('agreed','in_progress','partially_completed','completed','disputed','cancelled')),
  terms_snapshot jsonb not null,
  agreed_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(requesting_organization_id<>fulfilling_organization_id),
  check(completed_at is null or completed_at>=agreed_at),
  check(cancelled_at is null or cancelled_at>=agreed_at)
);
create index exchange_trades_requester_history_idx on public.exchange_trades(requesting_organization_id,status,agreed_at desc);
create index exchange_trades_fulfiller_history_idx on public.exchange_trades(fulfilling_organization_id,status,agreed_at desc);

create table public.exchange_trade_deliverables(
  id uuid primary key default gen_random_uuid(),
  exchange_trade_id uuid not null references public.exchange_trades(id) on delete cascade,
  responsible_organization_id uuid not null references public.organizations(id) on delete restrict,
  description text not null check(char_length(description) between 3 and 2000),
  due_at timestamptz,
  status text not null default 'pending' check(status in ('pending','in_progress','delivered','accepted','disputed','waived')),
  delivered_at timestamptz,
  accepted_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(delivered_at is null or delivered_at>=created_at),
  check(accepted_at is null or delivered_at is null or accepted_at>=delivered_at)
);
create index exchange_deliverables_trade_idx on public.exchange_trade_deliverables(exchange_trade_id,status,due_at);

create table public.exchange_trade_ratings(
  id uuid primary key default gen_random_uuid(),
  exchange_trade_id uuid not null references public.exchange_trades(id) on delete restrict,
  rater_organization_id uuid not null references public.organizations(id) on delete restrict,
  rated_organization_id uuid not null references public.organizations(id) on delete restrict,
  rated_by uuid not null references public.profiles(id) on delete restrict,
  overall_rating smallint not null check(overall_rating between 1 and 5),
  reliability_rating smallint check(reliability_rating between 1 and 5),
  communication_rating smallint check(communication_rating between 1 and 5),
  value_rating smallint check(value_rating between 1 and 5),
  capacity_accuracy_rating smallint check(capacity_accuracy_rating between 1 and 5),
  review text check(review is null or char_length(review)<=3000),
  status text not null default 'published' check(status in ('pending','published','hidden','disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(exchange_trade_id,rater_organization_id),
  check(rater_organization_id<>rated_organization_id)
);
create index exchange_trade_ratings_vendor_idx on public.exchange_trade_ratings(rated_organization_id,status,created_at desc) where status='published';

create table public.exchange_match_runs(
  id uuid primary key default gen_random_uuid(),
  requesting_organization_id uuid not null references public.organizations(id) on delete cascade,
  business_need_id uuid references public.exchange_business_needs(id) on delete set null,
  trade_request_id uuid references public.exchange_trade_requests(id) on delete set null,
  ai_optimization_run_id uuid references public.ai_optimization_runs(id) on delete set null,
  policy_key text not null default 'exchange_capacity_match',
  policy_version integer not null check(policy_version>0),
  status text not null default 'queued' check(status in ('queued','running','succeeded','failed','cancelled')),
  input_snapshot jsonb not null,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check(business_need_id is not null or trade_request_id is not null),
  check(completed_at is null or completed_at>=requested_at)
);
create index exchange_match_runs_org_idx on public.exchange_match_runs(requesting_organization_id,status,requested_at desc);

create table public.exchange_match_candidates(
  exchange_match_run_id uuid not null references public.exchange_match_runs(id) on delete cascade,
  candidate_organization_id uuid not null references public.organizations(id) on delete restrict,
  business_offer_id uuid references public.exchange_business_offers(id) on delete set null,
  rank integer not null check(rank>0),
  match_score numeric(7,4) not null check(match_score between 0 and 100),
  confidence numeric(6,5) check(confidence is null or confidence between 0 and 1),
  contributions jsonb not null,
  explanation jsonb,
  is_eligible boolean not null default true,
  exclusion_reasons text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  primary key(exchange_match_run_id,candidate_organization_id),
  unique(exchange_match_run_id,rank)
);

create table public.exchange_credit_programs(
  id uuid primary key default gen_random_uuid(),
  code text not null unique check(code ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  unit_name text not null,
  status text not null default 'planned' check(status in ('planned','pilot','active','paused','retired')),
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.exchange_credit_programs(code,name,unit_name,status,rules)
values('optimize_trade_credit','Optimize Trade Credits','credit','planned','{"transferable":false,"cash_equivalent":false,"ui_exposed":false,"requires_separate_legal_and_accounting_review":true}'::jsonb);

create table public.exchange_credit_accounts(
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.exchange_credit_programs(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  status text not null default 'pending' check(status in ('pending','active','frozen','closed')),
  available_balance bigint not null default 0 check(available_balance>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_id,organization_id)
);

create table public.exchange_credit_transactions(
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.exchange_credit_programs(id) on delete restrict,
  exchange_trade_id uuid references public.exchange_trades(id) on delete restrict,
  status text not null default 'pending' check(status in ('pending','posted','reversed','void')),
  idempotency_key text not null unique,
  description text not null,
  posted_at timestamptz,
  reversed_transaction_id uuid references public.exchange_credit_transactions(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check(status<>'posted' or posted_at is not null)
);

create table public.exchange_credit_entries(
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.exchange_credit_transactions(id) on delete restrict,
  account_id uuid not null references public.exchange_credit_accounts(id) on delete restrict,
  direction text not null check(direction in ('debit','credit')),
  amount bigint not null check(amount>0),
  created_at timestamptz not null default now(),
  unique(transaction_id,account_id)
);
create index exchange_credit_entries_account_idx on public.exchange_credit_entries(account_id,created_at desc);

create or replace function public.post_exchange_credit_transaction(target_transaction_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare tx public.exchange_credit_transactions%rowtype; debit_total bigint; credit_total bigint;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required'; end if;
  select * into tx from public.exchange_credit_transactions where id=target_transaction_id for update;
  if not found then raise exception 'credit transaction not found'; end if;
  if tx.status='posted' then return; end if;
  if tx.status<>'pending' then raise exception 'only pending credit transactions can be posted'; end if;
  if (select status from public.exchange_credit_programs where id=tx.program_id)<>'active' then raise exception 'trade credits are not active'; end if;
  select coalesce(sum(amount) filter(where direction='debit'),0),coalesce(sum(amount) filter(where direction='credit'),0)
  into debit_total,credit_total from public.exchange_credit_entries where transaction_id=tx.id;
  if debit_total=0 or debit_total<>credit_total then raise exception 'credit transaction entries must balance'; end if;
  if exists(select 1 from public.exchange_credit_entries e join public.exchange_credit_accounts a on a.id=e.account_id where e.transaction_id=tx.id and (a.program_id<>tx.program_id or a.status<>'active')) then raise exception 'credit account is not eligible'; end if;
  if exists(select 1 from public.exchange_credit_entries e join public.exchange_credit_accounts a on a.id=e.account_id where e.transaction_id=tx.id and e.direction='debit' and a.available_balance<e.amount for update) then raise exception 'insufficient trade credits'; end if;
  update public.exchange_credit_accounts a set available_balance=a.available_balance+case when e.direction='credit' then e.amount else -e.amount end,updated_at=now()
  from public.exchange_credit_entries e where e.transaction_id=tx.id and e.account_id=a.id;
  update public.exchange_credit_transactions set status='posted',posted_at=now() where id=tx.id;
  insert into public.outbox_events(topic,payload) values('exchange.credit_transaction_posted',jsonb_build_object('transaction_id',tx.id,'program_id',tx.program_id));
end $$;

create or replace function public.validate_exchange_proposal_party()
returns trigger language plpgsql set search_path='' as $$
declare request public.exchange_trade_requests%rowtype;
begin
  select * into request from public.exchange_trade_requests where id=new.trade_request_id;
  if not found then raise exception 'trade request not found'; end if;
  if new.proposing_organization_id=request.requesting_organization_id then raise exception 'requesting organization cannot propose to itself'; end if;
  if request.target_organization_id is not null and new.proposing_organization_id<>request.target_organization_id then raise exception 'proposal is not from the targeted organization'; end if;
  if request.status not in('open','negotiating') and new.status<>'draft' then raise exception 'trade request is not accepting proposals'; end if;
  return new;
end $$;
create trigger exchange_proposals_validate_party before insert or update on public.exchange_trade_proposals
for each row execute function public.validate_exchange_proposal_party();

create or replace function public.validate_exchange_trade_parties()
returns trigger language plpgsql set search_path='' as $$
declare request public.exchange_trade_requests%rowtype; proposal public.exchange_trade_proposals%rowtype;
begin
  select * into request from public.exchange_trade_requests where id=new.trade_request_id;
  select * into proposal from public.exchange_trade_proposals where id=new.accepted_proposal_id;
  if request.id is null or proposal.id is null or proposal.trade_request_id<>request.id then raise exception 'accepted proposal does not belong to the trade request'; end if;
  if new.requesting_organization_id<>request.requesting_organization_id or new.fulfilling_organization_id<>proposal.proposing_organization_id then raise exception 'trade parties do not match the accepted proposal'; end if;
  if proposal.status<>'accepted' then raise exception 'proposal must be accepted before creating a trade'; end if;
  return new;
end $$;
create trigger exchange_trades_validate_parties before insert on public.exchange_trades
for each row execute function public.validate_exchange_trade_parties();

create or replace function public.validate_exchange_rating_parties()
returns trigger language plpgsql set search_path='' as $$
declare trade public.exchange_trades%rowtype;
begin
  select * into trade from public.exchange_trades where id=new.exchange_trade_id;
  if trade.id is null or trade.status<>'completed' then raise exception 'only completed trades can be rated'; end if;
  if new.rater_organization_id not in(trade.requesting_organization_id,trade.fulfilling_organization_id)
     or new.rated_organization_id not in(trade.requesting_organization_id,trade.fulfilling_organization_id)
     or new.rater_organization_id=new.rated_organization_id then raise exception 'rating parties must be opposite sides of the completed trade'; end if;
  return new;
end $$;
create trigger exchange_ratings_validate_parties before insert or update on public.exchange_trade_ratings
for each row execute function public.validate_exchange_rating_parties();

do $$ declare table_name text; begin
  foreach table_name in array array['exchange_business_profiles','exchange_business_needs','exchange_business_offers','exchange_trade_requests','exchange_trade_proposals','exchange_trades','exchange_trade_deliverables','exchange_trade_ratings','exchange_credit_programs','exchange_credit_accounts'] loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',table_name,table_name);
  end loop;
end $$;

alter table public.exchange_trade_proposals add constraint exchange_proposal_not_requester check(proposing_organization_id is not null);
create trigger exchange_trade_requests_protect_keys before update on public.exchange_trade_requests for each row execute function public.prevent_key_reassignment('requesting_organization_id','created_by');
create trigger exchange_trade_proposals_protect_keys before update on public.exchange_trade_proposals for each row execute function public.prevent_key_reassignment('trade_request_id','proposing_organization_id','created_by');
create trigger exchange_trades_protect_keys before update on public.exchange_trades for each row execute function public.prevent_key_reassignment('trade_request_id','accepted_proposal_id','requesting_organization_id','fulfilling_organization_id');
create trigger exchange_ratings_protect_keys before update on public.exchange_trade_ratings for each row execute function public.prevent_key_reassignment('exchange_trade_id','rater_organization_id','rated_organization_id','rated_by');

do $$ declare table_name text; begin
  foreach table_name in array array['exchange_business_profiles','exchange_business_needs','exchange_business_offers','exchange_trade_requests','exchange_trade_proposals','exchange_proposal_items','exchange_trades','exchange_trade_deliverables','exchange_trade_ratings','exchange_match_runs','exchange_match_candidates','exchange_credit_programs','exchange_credit_accounts','exchange_credit_transactions','exchange_credit_entries'] loop
    execute format('alter table public.%I enable row level security',table_name);
  end loop;
end $$;

create policy "exchange_profiles_read_open" on public.exchange_business_profiles for select to authenticated using(open_to_trade or public.is_organization_member(organization_id) or public.is_super_admin());
create policy "exchange_profiles_manage_org" on public.exchange_business_profiles for all to authenticated using(public.has_organization_role(organization_id,array['owner','admin','vendor']::public.membership_role[])) with check(public.has_organization_role(organization_id,array['owner','admin','vendor']::public.membership_role[]));
create policy "exchange_needs_read" on public.exchange_business_needs for select to authenticated using((status='published' and exists(select 1 from public.exchange_business_profiles p where p.organization_id=organization_id and p.open_to_trade)) or public.is_organization_member(organization_id) or public.is_super_admin());
create policy "exchange_needs_manage" on public.exchange_business_needs for all to authenticated using(public.has_organization_role(organization_id,array['owner','admin','vendor']::public.membership_role[])) with check(public.has_organization_role(organization_id,array['owner','admin','vendor']::public.membership_role[]) and created_by=auth.uid());
create policy "exchange_offers_read" on public.exchange_business_offers for select to authenticated using((status='published' and exists(select 1 from public.exchange_business_profiles p where p.organization_id=organization_id and p.open_to_trade)) or public.is_organization_member(organization_id) or public.is_super_admin());
create policy "exchange_offers_manage" on public.exchange_business_offers for all to authenticated using(public.has_organization_role(organization_id,array['owner','admin','vendor']::public.membership_role[])) with check(public.has_organization_role(organization_id,array['owner','admin','vendor']::public.membership_role[]) and created_by=auth.uid());
create policy "exchange_requests_read_parties" on public.exchange_trade_requests for select to authenticated using(public.is_organization_member(requesting_organization_id) or (target_organization_id is not null and public.is_organization_member(target_organization_id)) or (target_organization_id is null and status in('open','negotiating')) or public.is_super_admin());
create policy "exchange_requests_manage_requester" on public.exchange_trade_requests for all to authenticated using(public.has_organization_role(requesting_organization_id,array['owner','admin','vendor']::public.membership_role[])) with check(public.has_organization_role(requesting_organization_id,array['owner','admin','vendor']::public.membership_role[]) and created_by=auth.uid());
create policy "exchange_proposals_read_parties" on public.exchange_trade_proposals for select to authenticated using(public.is_organization_member(proposing_organization_id) or exists(select 1 from public.exchange_trade_requests r where r.id=trade_request_id and public.is_organization_member(r.requesting_organization_id)) or public.is_super_admin());
create policy "exchange_proposals_manage_proposer" on public.exchange_trade_proposals for all to authenticated using(public.has_organization_role(proposing_organization_id,array['owner','admin','vendor']::public.membership_role[])) with check(public.has_organization_role(proposing_organization_id,array['owner','admin','vendor']::public.membership_role[]) and created_by=auth.uid());
create policy "exchange_proposal_items_read_parties" on public.exchange_proposal_items for select to authenticated using(exists(select 1 from public.exchange_trade_proposals p join public.exchange_trade_requests r on r.id=p.trade_request_id where p.id=trade_proposal_id and (public.is_organization_member(p.proposing_organization_id) or public.is_organization_member(r.requesting_organization_id))) or public.is_super_admin());
create policy "exchange_proposal_items_manage_proposer" on public.exchange_proposal_items for all to authenticated using(exists(select 1 from public.exchange_trade_proposals p where p.id=trade_proposal_id and p.status='draft' and public.has_organization_role(p.proposing_organization_id,array['owner','admin','vendor']::public.membership_role[]))) with check(exists(select 1 from public.exchange_trade_proposals p where p.id=trade_proposal_id and p.status='draft' and public.has_organization_role(p.proposing_organization_id,array['owner','admin','vendor']::public.membership_role[])));
create policy "exchange_trades_read_parties" on public.exchange_trades for select to authenticated using(public.is_organization_member(requesting_organization_id) or public.is_organization_member(fulfilling_organization_id) or public.is_super_admin());
create policy "exchange_deliverables_read_parties" on public.exchange_trade_deliverables for select to authenticated using(exists(select 1 from public.exchange_trades t where t.id=exchange_trade_id and (public.is_organization_member(t.requesting_organization_id) or public.is_organization_member(t.fulfilling_organization_id))) or public.is_super_admin());
create policy "exchange_deliverables_manage_party" on public.exchange_trade_deliverables for all to authenticated using(public.has_organization_role(responsible_organization_id,array['owner','admin','vendor']::public.membership_role[])) with check(public.has_organization_role(responsible_organization_id,array['owner','admin','vendor']::public.membership_role[]));
create policy "exchange_ratings_read_published" on public.exchange_trade_ratings for select to authenticated using(status='published' or public.is_organization_member(rater_organization_id) or public.is_organization_member(rated_organization_id) or public.is_super_admin());
create policy "exchange_ratings_create_party" on public.exchange_trade_ratings for insert to authenticated with check(rated_by=auth.uid() and public.has_organization_role(rater_organization_id,array['owner','admin','vendor']::public.membership_role[]) and exists(select 1 from public.exchange_trades t where t.id=exchange_trade_id and t.status='completed' and rater_organization_id in(t.requesting_organization_id,t.fulfilling_organization_id) and rated_organization_id in(t.requesting_organization_id,t.fulfilling_organization_id)));
create policy "exchange_matches_read_requester" on public.exchange_match_runs for select to authenticated using(public.is_organization_member(requesting_organization_id) or public.is_super_admin());
create policy "exchange_match_candidates_read_requester" on public.exchange_match_candidates for select to authenticated using(exists(select 1 from public.exchange_match_runs r where r.id=exchange_match_run_id and public.is_organization_member(r.requesting_organization_id)) or public.is_super_admin());
create policy "exchange_credit_catalog_admin" on public.exchange_credit_programs for select to authenticated using(public.is_super_admin());
create policy "exchange_credit_accounts_admin" on public.exchange_credit_accounts for select to authenticated using(public.is_super_admin());
create policy "exchange_credit_transactions_admin" on public.exchange_credit_transactions for select to authenticated using(public.is_super_admin());
create policy "exchange_credit_entries_admin" on public.exchange_credit_entries for select to authenticated using(public.is_super_admin());

grant select,insert,update,delete on public.exchange_business_profiles,public.exchange_business_needs,public.exchange_business_offers,public.exchange_trade_requests,public.exchange_trade_proposals,public.exchange_proposal_items,public.exchange_trade_deliverables,public.exchange_trade_ratings to authenticated;
grant select on public.exchange_trades,public.exchange_match_runs,public.exchange_match_candidates,public.exchange_credit_programs,public.exchange_credit_accounts,public.exchange_credit_transactions,public.exchange_credit_entries to authenticated;
grant all on public.exchange_business_profiles,public.exchange_business_needs,public.exchange_business_offers,public.exchange_trade_requests,public.exchange_trade_proposals,public.exchange_proposal_items,public.exchange_trades,public.exchange_trade_deliverables,public.exchange_trade_ratings,public.exchange_match_runs,public.exchange_match_candidates,public.exchange_credit_programs,public.exchange_credit_accounts,public.exchange_credit_transactions,public.exchange_credit_entries to service_role;
grant execute on function public.post_exchange_credit_transaction(uuid) to service_role;

comment on table public.exchange_business_profiles is 'Organization opt-in and capacity preferences for the UI-hidden Version 3 Optimize Local Exchange.';
comment on table public.exchange_business_needs is 'Published business demand that can be matched to unused local capacity.';
comment on table public.exchange_business_offers is 'Published unused business capacity offered for service exchange.';
comment on table public.exchange_trades is 'Accepted, snapshotted exchange agreement and durable trade history between two organizations.';
comment on table public.exchange_match_runs is 'Provider-neutral AI matching request linked optionally to a governed Optimize AI optimization run.';
comment on table public.exchange_credit_programs is 'Feature-gated future trade-credit program; seeded planned and unavailable to ordinary users.';

commit;
