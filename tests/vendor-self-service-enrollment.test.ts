import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/202607180023_vendor_self_service_enrollment.sql", import.meta.url), "utf8");
const lifecycleMigration = readFileSync(new URL("../supabase/migrations/202607180024_tier_driven_vendor_lifecycle.sql", import.meta.url), "utf8");
const action = readFileSync(new URL("../app/(platform)/onboarding/actions.ts", import.meta.url), "utf8");
const checkout = readFileSync(new URL("../src/lib/stripe/vendor-membership-checkout.ts", import.meta.url), "utf8");
const stripeMemberships = readFileSync(new URL("../src/lib/stripe/memberships.ts", import.meta.url), "utf8");
const onboardingPage = readFileSync(new URL("../app/(platform)/onboarding/page.tsx", import.meta.url), "utf8");
const signInAction = readFileSync(new URL("../app/(auth)/sign-in/actions.ts", import.meta.url), "utf8");
const adminAction = readFileSync(new URL("../app/(platform)/admin/founders/actions.ts", import.meta.url), "utf8");
const adminPage = readFileSync(new URL("../app/(platform)/admin/founders/page.tsx", import.meta.url), "utf8");
const successPage = readFileSync(new URL("../app/(platform)/vendor/membership/success/page.tsx", import.meta.url), "utf8");

test("brand-new authenticated vendor creation is one database transaction before Stripe", () => {
  assert.match(migration, /create or replace function public\.create_or_resume_vendor_enrollment/);
  for (const insert of ["organizations", "vendor_profiles", "organization_members", "vendor_memberships", "vendor_enrollments"]) assert.match(migration, new RegExp(`insert into public\\.${insert}`));
  assert.match(migration, /values\('vendor'[\s\S]*'onboarding'\)/);
  assert.match(migration, /values\(organization_id,target_user_id,'owner','active'\)/);
  assert.ok(action.indexOf('admin.rpc("create_or_resume_vendor_enrollment"') < action.lastIndexOf("continueVendorMembershipCheckout"));
  assert.match(signInAction, /shouldCreateUser: isVendorEnrollmentPath\(next\)/);
});

test("an existing user can create a separate vendor organization", () => {
  assert.match(onboardingPage, /requireUser\(\)/);
  assert.match(onboardingPage, /if \(!plan\) \{[\s\S]*user\.memberships\.length[\s\S]*\n  \}/);
  assert.match(onboardingPage, /VendorOrganizationSignupForm plan=\{plan\.key\}/);
  assert.match(migration, /owner_user_id uuid not null references public\.profiles/);
  assert.match(migration, /unique\(owner_user_id,normalized_business_name\)/);
  assert.match(successPage, /eq\("stripe_checkout_session_id",id\)/);
  assert.doesNotMatch(successPage, /eq\("vendor_organization_id"/);
});

test("double-submit and an existing pending enrollment resume the same records", () => {
  assert.match(migration, /select \* into selected_enrollment[\s\S]*for update/);
  assert.match(migration, /if found then[\s\S]*return query select selected_enrollment\.id/);
  assert.match(migration, /unique\(owner_user_id,normalized_business_name\)/);
  assert.match(onboardingPage, /Resume vendor enrollment/);
});

test("expired Checkout can resume with a new idempotent attempt", () => {
  assert.match(migration, /selected_membership\.status in \('expired','canceled','cancelled'\)/);
  assert.match(migration, /checkout_attempt_number=public\.vendor_memberships\.checkout_attempt_number\+1/);
  assert.match(checkout, /existing\.status === "open"/);
  assert.match(checkout, /existing\.status !== "expired"/);
  assert.match(stripeMemberships, /vendor-membership-\$\{input\.membershipId\}-attempt-\$\{input\.checkoutAttemptNumber\}/);
});

test("an existing active subscription blocks another Checkout", () => {
  assert.match(migration, /membership\.status in \('active','trialing','past_due','complimentary','manually_granted'\)/);
  assert.match(migration, /raise exception 'active membership already exists'/);
  assert.match(action, /already has a current membership/);
});

test("only the authenticated organization owner or admin can continue Checkout", () => {
  assert.match(migration, /user_id=target_user_id and status='active' and role in \('owner','admin'\)/);
  assert.match(migration, /raise exception 'not authorized for membership checkout'/);
  assert.match(checkout, /authorize_and_prepare_vendor_membership_checkout/);
  assert.match(migration, /revoke execute on function public\.authorize_and_prepare_vendor_membership_checkout[\s\S]*authenticated/);
});

test("database rollback happens before any Stripe Checkout call", () => {
  const transactionCall = action.indexOf('admin.rpc("create_or_resume_vendor_enrollment"');
  const stripeCall = action.lastIndexOf("continueVendorMembershipCheckout");
  assert.ok(transactionCall >= 0 && stripeCall > transactionCall);
  assert.match(action, /No Stripe Checkout Session was created/);
  assert.match(migration, /^begin;[\s\S]*commit;\s*$/);
});

test("Stripe failure preserves a recoverable pending organization and membership", () => {
  assert.match(checkout, /record_vendor_membership_checkout_failure/);
  assert.match(checkout, /existing\.status !== "expired"[\s\S]*fail_vendor_membership_checkout/);
  assert.match(checkout, /catch \(error\) \{[\s\S]*record_vendor_membership_checkout_failure/);
  assert.match(migration, /set status='payment_pending',last_checkout_error=/);
  assert.match(action, /saved, but Stripe Checkout could not be opened/);
});

test("Stripe metadata contains all internal activation identifiers", () => {
  for (const key of ["organization_id", "user_id", "membership_record_id", "membership_tier", "onboarding_version"]) assert.match(stripeMemberships, new RegExp(`${key}:`));
  assert.match(stripeMemberships, /mode:plan\.checkoutMode/);
});

test("pending enrollment data is private and payment controls publication", () => {
  assert.match(migration, /alter table public\.vendor_enrollments enable row level security/);
  assert.match(migration, /owner_user_id=auth\.uid\(\)/);
  assert.match(migration, /revoke all on table public\.vendor_enrollments from anon/);
  assert.doesNotMatch(lifecycleMigration, /sync_vendor_enrollment_status[\s\S]*update public\.organizations set status='active'/);
  assert.match(lifecycleMigration,/perform public\.evaluate_vendor_organization_activation/);
});

test("Super Admin can inspect and safely reset a failed pending Checkout", () => {
  assert.match(adminPage, /Pending vendor organization enrollments/);
  assert.match(adminPage, /admin\.from\("vendor_enrollments"\)/);
  assert.match(adminAction, /if \(!user\.isSuperAdmin\)/);
  assert.match(adminAction, /session\.status === "complete"/);
  assert.match(adminAction, /checkout\.sessions\.expire/);
  assert.match(adminAction, /authorize_and_prepare_vendor_membership_checkout/);
  assert.match(adminAction, /No payment status was changed|admin_reset_for_owner_retry/);
});
