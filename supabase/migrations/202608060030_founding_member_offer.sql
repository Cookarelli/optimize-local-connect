begin;

-- New purchases use the Founding Member annual subscription. Existing $299
-- payments and subscriptions remain historical records and are not rewritten.
update public.vendor_membership_levels
set name = 'Founding Member',
    description = 'A full year of premium local visibility and network access for early Rockford-area vendors.',
    rank = 30,
    monthly_price_cents = 0,
    annual_price_cents = 49900,
    one_time_price_cents = null,
    billing_model = 'subscription',
    capacity = 25,
    is_active = true,
    is_public = true,
    publicly_purchasable = true
where code = 'founding_partner';

commit;
