begin;

alter table public.vendor_memberships
  drop constraint if exists vendor_memberships_source_check;

alter table public.vendor_memberships
  add constraint vendor_memberships_source_check
  check (source in (
    'self_service',
    'admin',
    'founding_program',
    'migration',
    'billing_webhook',
    'guest_founding_checkout'
  ));

commit;
