begin;

insert into public.vendor_categories(slug,name,is_active,sort_order) values
  ('hvac','HVAC',true,10),('plumbing','Plumbing',true,20),('electrical','Electrical',true,30),('appliance-repair','Appliance Repair',true,40),('roofing','Roofing',true,50),('flooring','Flooring',true,60),('landscaping','Landscaping',true,70),('cleaning','Cleaning',true,80),('painting','Painting',true,90),('handyman','Handyman',true,100),('other','Other',true,110)
on conflict(slug) do update set name=excluded.name,is_active=true;

create table public.property_manager_service_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict, vendor_category_id uuid not null references public.vendor_categories(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict, unit text, address text not null, problem_description text not null check(char_length(trim(problem_description)) between 10 and 5000),
  priority text not null check(priority in ('emergency','today','this_week','flexible')), preferred_contact text not null check(preferred_contact in ('phone','email')), contact_phone text, contact_email text,
  photo_upload_requested boolean not null default false, status text not null default 'draft' check(status in ('draft','submitted','reviewing','assigned','completed','cancelled')),
  assigned_vendor_organization_id uuid references public.organizations(id) on delete set null, assigned_at timestamptz, submitted_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((preferred_contact='phone' and contact_phone is not null) or (preferred_contact='email' and contact_email is not null))
);
create index property_manager_service_requests_org_status_idx on public.property_manager_service_requests(organization_id,status,created_at desc);
create index property_manager_service_requests_category_idx on public.property_manager_service_requests(vendor_category_id,status);
create table public.property_manager_service_request_history (
  id bigint generated always as identity primary key, request_id uuid not null references public.property_manager_service_requests(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null, status text not null, note text, created_at timestamptz not null default now()
);
create index property_manager_service_request_history_idx on public.property_manager_service_request_history(request_id,created_at desc);
create trigger property_manager_service_requests_updated_at before update on public.property_manager_service_requests for each row execute function public.set_updated_at();
alter table public.property_manager_service_requests enable row level security;
alter table public.property_manager_service_request_history enable row level security;
create policy "pm_service_requests_read" on public.property_manager_service_requests for select to authenticated using (public.is_organization_member(organization_id) or public.is_super_admin());
create policy "pm_service_requests_create" on public.property_manager_service_requests for insert to authenticated with check(requested_by=auth.uid() and public.has_organization_role(organization_id,array['owner','admin','property_manager']::public.membership_role[]));
create policy "pm_service_request_history_read" on public.property_manager_service_request_history for select to authenticated using (exists(select 1 from public.property_manager_service_requests r where r.id=request_id and (public.is_organization_member(r.organization_id) or public.is_super_admin())));
revoke insert,update,delete on public.property_manager_service_requests,public.property_manager_service_request_history from authenticated;
grant select,insert on public.property_manager_service_requests to authenticated;
grant select on public.property_manager_service_request_history to authenticated;
grant all on public.property_manager_service_requests,public.property_manager_service_request_history to service_role;

commit;
