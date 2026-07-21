begin;
alter table public.property_manager_service_requests alter column property_id drop not null;
alter table public.property_manager_service_requests add column request_source text not null default 'property_manager_submitted' check(request_source in ('property_manager_submitted','admin_entered')), add column property_manager_contact_name text, add column vendor_visible_notes text, add column internal_admin_notes text, add column permission_to_share_confirmed boolean not null default false, add column permission_to_share_confirmed_at timestamptz, add column manual_property_name text, add column manual_city text;
commit;
