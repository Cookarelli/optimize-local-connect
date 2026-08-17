import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getVendorPlanByCode } from "../src/domain/vendor-memberships/catalog";
import { organizationMembershipId } from "../src/lib/firebase/platform";
import { emptyVendorProfile, rebuildPublicMarketplaceProjection } from "../src/lib/firebase/vendor-profiles";
import { getMigrationAuth, getMigrationFirestore } from "./firebase-migration/admin";

const projectId = process.env.FIREBASE_PROJECT_ID;
const confirmProject = process.argv.find((value) => value.startsWith("--confirm-project="))?.split("=", 2)[1];
const apply = process.argv.includes("--apply");
const password = process.env.FIREBASE_STAGING_TEST_PASSWORD;
if (!projectId || projectId === "optimize-local" || !projectId.includes("staging")) throw new Error("Staging seed requires a non-production FIREBASE_PROJECT_ID containing 'staging'.");
if (apply && confirmProject !== projectId) throw new Error(`Seed aborted. Pass --confirm-project=${projectId} after verifying the target.`);
if (apply && (!password || password.length < 14)) throw new Error("FIREBASE_STAGING_TEST_PASSWORD must be at least 14 characters for an applied seed.");

const now = Timestamp.fromDate(new Date("2026-08-17T12:00:00.000Z"));
const nextYear = Timestamp.fromDate(new Date("2027-08-17T12:00:00.000Z"));
const users = [
  { uid: "staging-super-admin", email: "super-admin@staging.optimizelocal.example", displayName: "Staging Super Admin" },
  { uid: "staging-pm-owner", email: "pm-owner@staging.optimizelocal.example", displayName: "Rockford PM Demo Owner" },
  { uid: "staging-founder-owner", email: "founder-owner@staging.optimizelocal.example", displayName: "North Star Flooring Demo Owner" },
  { uid: "staging-preferred-owner", email: "preferred-owner@staging.optimizelocal.example", displayName: "Prairie Electric Demo Owner" },
  { uid: "staging-network-owner", email: "network-owner@staging.optimizelocal.example", displayName: "River City Plumbing Demo Owner" },
] as const;

const organizations = [
  { id: "staging-pm-rockford", type: "property_manager", name: "Rockford Property Management Demo", email: users[1].email, membershipId: null },
  { id: "staging-pm-other", type: "property_manager", name: "Other PM Security Boundary Demo", email: "pm-other@staging.optimizelocal.example", membershipId: null },
  { id: "staging-founder-paid", type: "vendor", name: "North Star Flooring Demo", email: users[2].email, membershipId: "staging-membership-founder-paid" },
  { id: "staging-founder-manual", type: "vendor", name: "Demo Exterior Services — Manual Founder Fixture", email: "manual-founder@staging.optimizelocal.example", membershipId: "staging-membership-founder-manual" },
  { id: "staging-vendor-preferred", type: "vendor", name: "Prairie Electric Demo", email: users[3].email, membershipId: "staging-membership-preferred" },
  { id: "staging-vendor-network", type: "vendor", name: "River City Plumbing Demo", email: users[4].email, membershipId: "staging-membership-network" },
] as const;

const membershipSpecs = [
  { id: "staging-membership-founder-paid", organizationId: "staging-founder-paid", tier: "founding_partner", status: "active", categorySlug: "flooring", paymentSource: "stripe_paid", amount: 49_900, stripe: { customerId: "cus_test_olc_staging_founder", checkoutSessionId: "cs_test_olc_staging_founder", subscriptionId: "sub_test_olc_staging_founder", priceId: "price_test_olc_staging_founder_499_year" } },
  { id: "staging-membership-founder-manual", organizationId: "staging-founder-manual", tier: "founding_partner", status: "manually_granted", categorySlug: "roofing", paymentSource: "manually_granted", amount: null, stripe: null },
  { id: "staging-membership-preferred", organizationId: "staging-vendor-preferred", tier: "preferred", status: "active", categorySlug: null, paymentSource: "stripe_paid", amount: 4_900, stripe: { customerId: "cus_test_olc_staging_preferred", checkoutSessionId: "cs_test_olc_staging_preferred", subscriptionId: "sub_test_olc_staging_preferred", priceId: "price_test_olc_staging_preferred_49_month" } },
  { id: "staging-membership-network", organizationId: "staging-vendor-network", tier: "network", status: "active", categorySlug: null, paymentSource: "stripe_paid", amount: 1_900, stripe: { customerId: "cus_test_olc_staging_network", checkoutSessionId: "cs_test_olc_staging_network", subscriptionId: "sub_test_olc_staging_network", priceId: "price_test_olc_staging_network_19_month" } },
] as const;

const profileSpecs = [
  { organizationId: "staging-founder-paid", businessName: "North Star Flooring Demo", categorySlug: "flooring", services: ["Carpet installation", "Hardwood repair"], benefit: "10% off a first demo work order", tier: "founding_partner" },
  { organizationId: "staging-founder-manual", businessName: "Demo Exterior Services — Manual Founder Fixture", categorySlug: "roofing", services: ["Roof inspections", "Storm repair"], benefit: "Free demo property inspection", tier: "founding_partner" },
  { organizationId: "staging-vendor-preferred", businessName: "Prairie Electric Demo", categorySlug: "electrical", services: ["Panel service", "Common-area lighting"], benefit: "Priority demo scheduling", tier: "preferred" },
  { organizationId: "staging-vendor-network", businessName: "River City Plumbing Demo", categorySlug: "plumbing-sewer", services: ["Leak repair", "Drain service"], benefit: null, tier: "network" },
] as const;

const paths = [
  ...users.flatMap((user) => [`users/${user.uid}`, ...(user.uid === "staging-super-admin" ? [`platformAdmins/${user.uid}`] : [])]),
  ...organizations.map((organization) => `organizations/${organization.id}`),
  ...membershipSpecs.map((membership) => `memberships/${membership.id}`),
  ...profileSpecs.map((profile) => `vendorProfiles/${profile.organizationId}`),
  "properties/staging-property-main", "properties/staging-property-riverside", "properties/staging-property-north", "properties/staging-property-other",
  "founderCategories/flooring", "founderCategories/roofing", "founderOccupancies/staging-founder-paid", "founderOccupancies/staging-founder-manual",
  "founderPayments/staging-founder-paid-test-payment",
  "organizations/founder-authoritative-org", "memberships/founder-authoritative-membership", "vendorProfiles/founder-authoritative-org",
];
const manifest = { projectId, users: users.length, organizations: organizations.length, memberships: membershipSpecs.length, profiles: profileSpecs.length, properties: 4, founderCollisionAnchors: 3, pathsChecksum: createHash("sha256").update(JSON.stringify(paths.sort())).digest("hex") };
if (!apply) {
  process.stdout.write(`${JSON.stringify({ mode: "dry-run", ...manifest }, null, 2)}\n`);
  process.exit(0);
}

const auth = getMigrationAuth();
const db = getMigrationFirestore();
for (const user of users) {
  try {
    const existing = await auth.getUser(user.uid);
    if (existing.email?.toLowerCase() !== user.email) throw new Error(`UID collision for ${user.uid}.`);
    await auth.updateUser(user.uid, { displayName: user.displayName, emailVerified: true, password });
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    await auth.createUser({ uid: user.uid, email: user.email, displayName: user.displayName, emailVerified: true, password });
  }
}

const batch = db.batch();
for (const user of users) batch.set(db.doc(`users/${user.uid}`), { email: user.email, displayName: user.displayName, avatarUrl: null, status: "active", createdAt: now, updatedAt: now });
batch.set(db.doc("platformAdmins/staging-super-admin"), { status: "active", role: "super_admin", createdAt: now, updatedAt: now });
for (const organization of organizations) batch.set(db.doc(`organizations/${organization.id}`), {
  type: organization.type, status: "active", name: organization.name, normalizedName: organization.name.toLowerCase(), slug: organization.id,
  legalName: null, primaryEmail: organization.email, primaryPhone: "815-555-0100", websiteUrl: "https://example.test",
  activeMembershipId: organization.membershipId, pendingMembershipId: null, stagingFixture: true, createdAt: now, updatedAt: now,
});
batch.set(db.doc("organizations/founder-authoritative-org"), { name: "Authoritative Founder Collision Fixture", normalizedName: "authoritative founder collision fixture", slug: "authoritative-founder-collision-fixture", type: "vendor", status: "active", legalName: null, primaryEmail: "collision-founder@staging.optimizelocal.example", primaryPhone: null, websiteUrl: null, activeMembershipId: "founder-authoritative-membership", pendingMembershipId: null, stagingFixture: true, createdAt: now, updatedAt: now });
batch.set(db.doc("memberships/founder-authoritative-membership"), { organizationId: "founder-authoritative-org", tier: "founding_partner", priority: 30, status: "manually_granted", categorySlug: "flooring", paymentSource: "manually_granted", listPriceCents: 49_900, actualAmountPaidCents: null, currency: "USD", stripe: null, paypal: null, currentPeriodEndsAt: null, cancelAtPeriodEnd: false, checkoutAttemptNumber: 0, entitlementsVersion: 1, entitlementSnapshot: getVendorPlanByCode("founding_partner")!.entitlements, stagingFixture: true, createdAt: now, updatedAt: now });
batch.set(db.doc("vendorProfiles/founder-authoritative-org"), { ...emptyVendorProfile({ organizationId: "founder-authoritative-org", businessName: "Authoritative Founder Collision Fixture", categorySlug: "flooring" }, now), stagingFixture: true });
const access = [
  ["staging-pm-rockford", users[1].uid, "property_manager", "owner"],
  ["staging-founder-paid", users[2].uid, "vendor", "owner"],
  ["staging-vendor-preferred", users[3].uid, "vendor", "owner"],
  ["staging-vendor-network", users[4].uid, "vendor", "owner"],
] as const;
for (const [organizationId, userId, organizationType, role] of access) batch.set(db.doc(`organizationMemberships/${organizationMembershipId(organizationId, userId)}`), { organizationId, userId, organizationType, role, status: "active", invitedAt: null, acceptedAt: now, createdAt: now, updatedAt: now });
for (const membership of membershipSpecs) {
  const plan = getVendorPlanByCode(membership.tier)!;
  batch.set(db.doc(`memberships/${membership.id}`), {
    organizationId: membership.organizationId, tier: membership.tier, priority: plan.placementPriority, status: membership.status,
    categorySlug: membership.categorySlug, paymentSource: membership.paymentSource, listPriceCents: plan.amountCents,
    actualAmountPaidCents: membership.amount, currency: "USD", stripe: membership.stripe, paypal: null,
    currentPeriodEndsAt: membership.status === "manually_granted" ? null : nextYear, cancelAtPeriodEnd: false,
    checkoutAttemptNumber: membership.stripe ? 1 : 0, entitlementsVersion: 1, entitlementSnapshot: plan.entitlements,
    stagingFixture: true, createdAt: now, updatedAt: now,
  });
}
for (const profile of profileSpecs) {
  const base = emptyVendorProfile({ organizationId: profile.organizationId, businessName: profile.businessName, categorySlug: profile.categorySlug }, now);
  batch.set(db.doc(`vendorProfiles/${profile.organizationId}`), {
    ...base,
    description: `${profile.businessName} is a fictional, non-production business created solely for the Firebase staging rehearsal.`,
    additionalCategorySlugs: profile.organizationId === "staging-vendor-preferred" ? ["plumbing-sewer"] : [],
    services: profile.services, serviceAreaKeys: ["rockford-il"], serviceRadiusMiles: 35,
    publicPhone: "815-555-0199", publicEmail: `${profile.organizationId}@staging.optimizelocal.example`, websiteUrl: "https://example.test",
    customerTypes: ["property_managers"], offersFreeEstimates: true, insurance: { status: "insured", expiresAt: nextYear },
    connectMemberBenefit: profile.benefit ? { enabled: true, title: "Connect Member Benefit", description: profile.benefit, type: "discount", terms: "Staging demonstration only", expiresAt: nextYear } : base.connectMemberBenefit,
    approvalState: "approved", publicationState: "published", publicDisplayConsent: true, reviewedBy: users[0].uid, reviewedAt: now, stagingFixture: true, updatedAt: now,
  });
}
const properties = [
  ["staging-property-main", "Demo Main Street Apartments", "100 Main St", "61101"],
  ["staging-property-riverside", "Demo Riverside Commons", "200 River Rd", "61107"],
  ["staging-property-north", "Demo North Campus", "300 North Ave", "61103"],
] as const;
for (const [id, name, line1, postalCode] of properties) batch.set(db.doc(`properties/${id}`), { organizationId: "staging-pm-rockford", name, address: { line1, line2: null, city: "Rockford", stateCode: "IL", postalCode }, serviceAreaKey: "rockford-il", status: "active", createdBy: users[1].uid, stagingFixture: true, createdAt: now, updatedAt: now });
batch.set(db.doc("properties/staging-property-other"), { organizationId: "staging-pm-other", name: "Other PM Private Property", address: { line1: "999 Boundary Rd", line2: null, city: "Rockford", stateCode: "IL", postalCode: "61108" }, serviceAreaKey: "rockford-il", status: "active", createdBy: "staging-other-pm", stagingFixture: true, createdAt: now, updatedAt: now });
for (const founder of [
  { slug: "flooring", name: "Flooring", organizationId: "staging-founder-paid", membershipId: "staging-membership-founder-paid", businessName: "North Star Flooring Demo", paymentSource: "stripe_paid" },
  { slug: "roofing", name: "Roofing", organizationId: "staging-founder-manual", membershipId: "staging-membership-founder-manual", businessName: "Demo Exterior Services — Manual Founder Fixture", paymentSource: "manually_granted" },
] as const) {
  batch.set(db.doc(`founderCategories/${founder.slug}`), { displayName: founder.name, slug: founder.slug, displayOrder: founder.slug === "roofing" ? 1 : 2, status: "claimed", claimedOrganizationId: founder.organizationId, membershipId: founder.membershipId, publicBusinessName: founder.businessName, paymentSource: founder.paymentSource, stagingFixture: true, updatedAt: now });
  batch.set(db.doc(`founderOccupancies/${founder.organizationId}`), { organizationId: founder.organizationId, membershipId: founder.membershipId, categorySlug: founder.slug, status: "claimed", stagingFixture: true, createdAt: now, updatedAt: now });
}
batch.set(db.doc("founderPayments/staging-founder-paid-test-payment"), { organizationId: "staging-founder-paid", membershipId: "staging-membership-founder-paid", provider: "stripe", providerPaymentId: "pi_test_olc_staging_founder", amountPaidCents: 49_900, currency: "USD", status: "paid", stagingFixture: true, createdAt: now, updatedAt: now });
await batch.commit();
for (const profile of profileSpecs) await rebuildPublicMarketplaceProjection(profile.organizationId, db);
process.stdout.write(`${JSON.stringify({ mode: "apply", ...manifest }, null, 2)}\n`);
