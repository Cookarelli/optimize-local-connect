import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { foundingPartnerDraftSchema, foundingPartnerSubmissionSchema } from "../src/domain/founding-partner/onboarding";

const migration = readFileSync(new URL("../supabase/migrations/202607140016_founding_partner_onboarding.sql", import.meta.url), "utf8");
const accessRoute = readFileSync(new URL("../app/founders/onboarding/access/route.ts", import.meta.url), "utf8");
const action = readFileSync(new URL("../app/founders/actions.ts", import.meta.url), "utf8");

const completeApplication = {
  businessName: "Cook Home Services",
  contactName: "Steven Cook",
  phone: "214-555-0112",
  website: "https://example.com",
  businessDescription: "Local home-service company serving residential and commercial customers.",
  yearsInBusiness: "7",
  primaryServiceCategory: "Plumbing",
  additionalServiceCategories: [],
  servicesOffered: ["Water heater repair"],
  serviceAreaCities: ["Dallas, TX"],
  serviceRadiusMiles: "35",
  customerType: "both",
  emergencyServiceAvailable: true,
  operatingHours: "Monday through Friday, 7 AM to 6 PM",
  licenseApplicable: false,
  licenseNumber: "",
  insuranceStatus: "insured",
  preferredContactMethod: "phone",
  googleBusinessProfileUrl: "",
  facebookPageUrl: "",
  otherSocialLinks: [],
  profileHeadline: "Reliable plumbing service across North Dallas",
  companyBio: "Our experienced local team handles repairs and installations with clear communication and dependable scheduling.",
  logoUrl: "",
  featuredImageUrl: "",
  offersFreeEstimates: true,
  offersFinancing: false,
  languagesSpoken: ["English"],
  accuracyConfirmed: true,
  publicDisplayConsent: true,
  termsPrivacyAccepted: true,
} as const;

test("partial Founding Partner applications can be saved as drafts", () => {
  const partial = { ...completeApplication, businessName: "", servicesOffered: [], accuracyConfirmed: false };
  assert.equal(foundingPartnerDraftSchema.safeParse(partial).success, true);
  assert.equal(foundingPartnerSubmissionSchema.safeParse(partial).success, false);
});

test("license number is required only when licensing applies", () => {
  assert.equal(foundingPartnerSubmissionSchema.safeParse(completeApplication).success, true);
  const licensed = foundingPartnerSubmissionSchema.safeParse({ ...completeApplication, licenseApplicable: true, licenseNumber: "" });
  assert.equal(licensed.success, false);
  if (!licensed.success) assert.equal(licensed.error.issues.some(issue => issue.path[0] === "licenseNumber"), true);
});

test("post-payment session exchange uses a verified paid database record and issues a protected cookie", () => {
  assert.match(accessRoute, /eq\("checkout_session_id", sessionId\.data\)/);
  assert.match(accessRoute, /eq\("payment_status", "paid"\)/);
  assert.match(accessRoute, /eq\("amount_paid_cents", 29900\)/);
  assert.match(accessRoute, /eq\("currency", "USD"\)/);
  assert.match(accessRoute, /access_token_hash: tokenHash/);
  assert.match(accessRoute, /httpOnly: true/);
  assert.match(accessRoute, /sameSite: "lax"/);
  assert.match(accessRoute, /new URL\("\/founders\/onboarding", request\.url\)/);
});

test("onboarding saves resolve server-side access instead of accepting a session id", () => {
  assert.match(action, /resolveFoundingPartnerOnboardingAccess\(\)/);
  assert.doesNotMatch(action, /formData\.get\("sessionId"\)/);
  assert.match(action, /save_founding_partner_onboarding/);
});

test("database enforces the lifecycle, draft edit rules, and submission timestamp", () => {
  for (const status of ["payment_pending", "paid_onboarding_incomplete", "submitted", "under_review", "approved", "changes_requested", "rejected", "active", "suspended"]) {
    assert.match(migration, new RegExp(`'${status}'`));
  }
  assert.match(migration, /access_token_hash text/);
  assert.match(migration, /onboarding\.status not in \('paid_onboarding_incomplete','changes_requested'\)/);
  assert.match(migration, /submitted_at=case when target_submit then now\(\)/);
  assert.match(migration, /license number is required when licensing applies/);
  assert.match(migration, /revoke execute on function public\.save_founding_partner_onboarding/);
});
