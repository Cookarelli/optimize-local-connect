begin;

alter table public.founding_claims
  add column if not exists checkout_reference text,
  add column if not exists checkout_expires_at timestamptz;

create unique index if not exists founding_claims_checkout_reference_idx
on public.founding_claims(payment_provider,checkout_reference)
where checkout_reference is not null;

drop policy if exists "founding_claims_update_own_logo" on public.founding_claims;
revoke update on public.founding_claims from authenticated;

create or replace function public.set_founding_claim_logo(target_claim_id uuid,target_logo_url text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.founding_claims
  set logo_url=target_logo_url,updated_at=now()
  where id=target_claim_id and user_id=auth.uid()
    and status in ('pending_payment','payment_submitted','awaiting_verification');
  if not found then raise exception 'claim is not editable'; end if;
end $$;

create or replace function public.set_founding_claim_checkout(
  target_claim_id uuid,target_checkout_reference text,target_expires_at timestamptz
) returns void language plpgsql security definer set search_path='' as $$
declare claim public.founding_claims%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if target_checkout_reference !~ '^cs_(test_|live_)?[A-Za-z0-9]+$' then raise exception 'invalid checkout reference'; end if;
  if target_expires_at <= now() or target_expires_at > now()+interval '35 minutes' then raise exception 'invalid checkout expiration'; end if;
  select * into claim from public.founding_claims where id=target_claim_id and user_id=auth.uid() for update;
  if not found or claim.status not in ('pending_payment','payment_submitted','awaiting_verification') then raise exception 'claim is not awaiting checkout'; end if;
  update public.founding_claims set
    status='awaiting_verification',checkout_reference=target_checkout_reference,
    checkout_expires_at=target_expires_at,expires_at=target_expires_at,
    metadata=metadata||jsonb_build_object('checkout_mode','stripe_checkout','checkout_session_id',target_checkout_reference),updated_at=now()
  where id=claim.id;
  update public.founding_seats set hold_expires_at=target_expires_at,updated_at=now()
  where id=claim.seat_id and status='pending_payment';
end $$;

grant execute on function public.set_founding_claim_logo(uuid,text) to authenticated;
grant execute on function public.set_founding_claim_checkout(uuid,text,timestamptz) to authenticated;

comment on column public.founding_claims.checkout_reference is 'Provider checkout-session reference, distinct from the completed payment transaction reference.';
comment on function public.set_founding_claim_logo is 'Narrow owner operation replacing broad direct updates on pending claims.';
comment on function public.set_founding_claim_checkout is 'Attaches one provider-created checkout session and aligns the seat hold with its expiration.';

commit;
