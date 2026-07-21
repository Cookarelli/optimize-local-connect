begin;

create table public.vendor_prospects (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (char_length(trim(business_name)) between 2 and 180),
  contact_name text, phone text, email text, website text, city text, industry text,
  google_rating numeric(2,1) check (google_rating between 0 and 5),
  google_review_count integer check (google_review_count >= 0),
  membership_target text not null check (membership_target in ('Founder','Preferred','Network','Listed')),
  sales_stage text not null default 'Not Contacted' check (sales_stage in ('Not Contacted','Called','Left Voicemail','Interested','Follow Up','Demo Scheduled','Checkout Sent','Paid','Active','Not Interested')),
  last_contact_at timestamptz, next_follow_up_at timestamptz, notes text check (notes is null or char_length(notes) <= 5000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index vendor_prospects_stage_idx on public.vendor_prospects(sales_stage, next_follow_up_at);
create index vendor_prospects_industry_idx on public.vendor_prospects(industry);
create index vendor_prospects_target_idx on public.vendor_prospects(membership_target);
create index vendor_prospects_search_idx on public.vendor_prospects using gin (to_tsvector('simple', coalesce(business_name,'') || ' ' || coalesce(contact_name,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(email,'') || ' ' || coalesce(city,'') || ' ' || coalesce(industry,'')));

create trigger vendor_prospects_set_updated_at before update on public.vendor_prospects for each row execute function public.set_updated_at();
alter table public.vendor_prospects enable row level security;
-- No direct authenticated policies: prospect data is available only through server-side Super Admin workflows.
grant all on public.vendor_prospects to service_role;

commit;
