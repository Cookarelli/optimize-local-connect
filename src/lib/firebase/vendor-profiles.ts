import "server-only";

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { AppUser } from "@/src/domain/auth/types";
import { FOUNDER_CATEGORY_CATALOG, isFounderCategorySlug } from "@/src/domain/founder-categories/catalog";
import { getVendorPlanByCode } from "@/src/domain/vendor-memberships/catalog";
import type { CommercialMembershipDocument, OrganizationDocument, VendorProfileDocument } from "@/src/domain/firebase-platform/types";
import { getPlatformFirestore } from "@/src/lib/firebase/admin";
import { requireOrganizationMembership, requirePlatformAdmin } from "@/src/lib/firebase/authorization";
import { isOperationalMembership } from "@/src/lib/firebase/memberships";
import { matchingKeys, normalizeSearchTokens, normalizeServiceArea, normalizedText, slugify } from "@/src/lib/firebase/platform";
import { promoteFirebaseVendorMedia } from "@/src/lib/firebase/storage";

const PUBLIC_PROFILE_FIELDS = [
  "organizationId", "businessName", "slug", "description", "logoUrl", "featuredImageUrl", "primaryCategorySlug", "primaryCategoryName",
  "categorySlugs", "categoryNames", "services", "serviceAreaKeys", "serviceAreas", "serviceRadiusMiles", "publicPhone", "publicEmail", "websiteUrl",
  "googleBusinessProfileUrl", "operatingHours", "languages", "yearsInBusiness", "customerTypes", "offersFreeEstimates", "offersFinancing",
  "emergencyService", "licenseListed", "insuranceStatus", "connectMemberBenefit", "membershipTier", "membershipName", "membershipPriority",
  "badgeLabel", "isFoundingMember", "searchTokens", "matchingKeys", "publicationVersion", "publishedAt",
] as const;

export function emptyVendorProfile(input: { organizationId: string; businessName: string; categorySlug?: string | null }, now = Timestamp.now()): VendorProfileDocument {
  return {
    organizationId: input.organizationId,
    businessName: normalizedText(input.businessName),
    slug: slugify(input.businessName),
    description: "",
    primaryCategorySlug: input.categorySlug ?? "",
    additionalCategorySlugs: [],
    services: [],
    serviceAreaKeys: [],
    serviceRadiusMiles: null,
    publicPhone: null,
    publicEmail: null,
    websiteUrl: null,
    googleBusinessProfileUrl: null,
    operatingHours: null,
    languages: [],
    yearsInBusiness: null,
    customerTypes: [],
    offersFreeEstimates: false,
    offersFinancing: false,
    emergencyService: false,
    license: { applies: false, number: null, jurisdiction: null, expiresAt: null },
    insurance: { status: "unknown", expiresAt: null },
    connectMemberBenefit: { enabled: false, title: null, description: null, type: null, terms: null, expiresAt: null },
    media: { logoPath: null, logoUrl: null, featuredImagePath: null, featuredImageUrl: null },
    approvalState: "pending",
    publicationState: "unpublished",
    publicDisplayConsent: false,
    reviewNote: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function titleFromSlug(slug: string) {
  return slug.split("-").map((part) => part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part).join(" ");
}

function categoryNameFromSlug(slug: string) {
  return FOUNDER_CATEGORY_CATALOG.find((category) => category.slug === slug)?.displayName ?? titleFromSlug(slug);
}

export function vendorProfileCompleteness(profile: Partial<VendorProfileDocument>) {
  const missing: string[] = [];
  if ((profile.businessName?.trim().length ?? 0) < 2) missing.push("business_name");
  if ((profile.description?.trim().length ?? 0) < 40) missing.push("description");
  if (!profile.publicEmail || !/^\S+@\S+\.\S+$/.test(profile.publicEmail)) missing.push("public_email");
  if (!profile.publicPhone) missing.push("public_phone");
  if (!profile.primaryCategorySlug) missing.push("primary_category");
  if (!profile.services?.length) missing.push("services");
  if (!profile.serviceAreaKeys?.length) missing.push("service_areas");
  if (!profile.publicDisplayConsent) missing.push("public_display_consent");
  return { complete: missing.length === 0, missing, completed: 8 - missing.length, total: 8 };
}

export async function saveFirebaseVendorProfile(input: {
  user: AppUser;
  organizationId: string;
  businessName: string;
  description: string;
  primaryCategorySlug: string;
  additionalCategorySlugs?: string[];
  services: string[];
  serviceAreas: string[];
  serviceRadiusMiles?: number | null;
  publicPhone: string;
  publicEmail: string;
  websiteUrl?: string | null;
  googleBusinessProfileUrl?: string | null;
  operatingHours?: string | null;
  languages?: string[];
  yearsInBusiness?: number | null;
  customerTypes?: string[];
  offersFreeEstimates?: boolean;
  offersFinancing?: boolean;
  emergencyService?: boolean;
  license?: Partial<VendorProfileDocument["license"]>;
  insurance?: Partial<VendorProfileDocument["insurance"]>;
  connectMemberBenefit?: Partial<VendorProfileDocument["connectMemberBenefit"]>;
  publicDisplayConsent: boolean;
}, db: Firestore = getPlatformFirestore()) {
  requireOrganizationMembership(input.user, input.organizationId, ["owner", "admin"]);
  const profileRef = db.doc(`vendorProfiles/${input.organizationId}`);
  const organizationRef = db.doc(`organizations/${input.organizationId}`);
  const [profileSnapshot, organizationSnapshot] = await Promise.all([profileRef.get(), organizationRef.get()]);
  if (!organizationSnapshot.exists || organizationSnapshot.data()?.type !== "vendor") throw new Error("Vendor organization not found.");
  const now = Timestamp.now();
  const current = profileSnapshot.exists
    ? profileSnapshot.data() as VendorProfileDocument
    : emptyVendorProfile({ organizationId: input.organizationId, businessName: input.businessName }, now);
  const categorySlugs = [...new Set([input.primaryCategorySlug, ...(input.additionalCategorySlugs ?? [])].map(slugify).filter(Boolean))].slice(0, 12);
  if (!categorySlugs.length || categorySlugs.some((category) => !isFounderCategorySlug(category))) throw new Error("Select only active service categories.");
  const services = [...new Set(input.services.map(normalizedText).filter(Boolean))].slice(0, 50);
  const serviceAreaKeys = [...new Set(input.serviceAreas.map(normalizeServiceArea).filter(Boolean))].slice(0, 50);
  const profile: VendorProfileDocument = {
    ...current,
    businessName: normalizedText(input.businessName),
    slug: current.slug || slugify(input.businessName),
    description: normalizedText(input.description),
    primaryCategorySlug: categorySlugs[0] ?? "",
    additionalCategorySlugs: categorySlugs.slice(1),
    services,
    serviceAreaKeys,
    serviceRadiusMiles: input.serviceRadiusMiles ?? null,
    publicPhone: input.publicPhone.trim(),
    publicEmail: input.publicEmail.trim().toLowerCase(),
    websiteUrl: input.websiteUrl ?? null,
    googleBusinessProfileUrl: input.googleBusinessProfileUrl ?? null,
    operatingHours: input.operatingHours ?? null,
    languages: [...new Set(input.languages?.map(normalizedText).filter(Boolean) ?? [])].slice(0, 20),
    yearsInBusiness: input.yearsInBusiness ?? null,
    customerTypes: [...new Set(input.customerTypes?.map(normalizedText).filter(Boolean) ?? [])].slice(0, 20),
    offersFreeEstimates: Boolean(input.offersFreeEstimates),
    offersFinancing: Boolean(input.offersFinancing),
    emergencyService: Boolean(input.emergencyService),
    license: { ...current.license, ...input.license },
    insurance: { ...current.insurance, ...input.insurance },
    connectMemberBenefit: { ...current.connectMemberBenefit, ...input.connectMemberBenefit },
    publicDisplayConsent: input.publicDisplayConsent,
    approvalState: "pending",
    publicationState: current.publicationState === "published" ? "unpublished" : current.publicationState,
    updatedAt: now,
  };
  await db.runTransaction(async (transaction) => {
    transaction.set(profileRef, profile);
    transaction.set(organizationRef, { name: profile.businessName, normalizedName: profile.businessName.toLowerCase(), slug: profile.slug, updatedAt: now }, { merge: true });
    transaction.delete(db.doc(`publicMarketplaceVendors/${input.organizationId}`));
  });
  return vendorProfileCompleteness(profile);
}

export async function rebuildPublicMarketplaceProjection(organizationId: string, db: Firestore = getPlatformFirestore()) {
  const organizationRef = db.doc(`organizations/${organizationId}`);
  const profileRef = db.doc(`vendorProfiles/${organizationId}`);
  const publicRef = db.doc(`publicMarketplaceVendors/${organizationId}`);
  return db.runTransaction(async (transaction) => {
    const [organizationSnapshot, profileSnapshot] = await Promise.all([transaction.get(organizationRef), transaction.get(profileRef)]);
    const organization = organizationSnapshot.data();
    const profile = profileSnapshot.data() as VendorProfileDocument | undefined;
    if (!organization || !profile || !organization.activeMembershipId) {
      transaction.delete(publicRef);
      return { published: false, reason: "missing_foundation" };
    }
    const membershipSnapshot = await transaction.get(db.doc(`memberships/${organization.activeMembershipId}`));
    const membership = membershipSnapshot.data();
    const eligible = organization.status === "active" && membership && isOperationalMembership(membership)
      && profile.approvalState === "approved" && profile.publicationState === "published" && profile.publicDisplayConsent
      && vendorProfileCompleteness(profile).complete;
    if (!eligible) {
      transaction.delete(publicRef);
      return { published: false, reason: "ineligible" };
    }
    const plan = getVendorPlanByCode(membership.tier);
    if (!plan) {
      transaction.delete(publicRef);
      return { published: false, reason: "unknown_membership" };
    }
    const categories = [profile.primaryCategorySlug, ...profile.additionalCategorySlugs].filter(Boolean);
    const now = Timestamp.now();
    const publicDocument = {
      organizationId,
      businessName: profile.businessName,
      slug: profile.slug,
      description: profile.description,
      logoUrl: profile.media.logoUrl,
      featuredImageUrl: profile.media.featuredImageUrl,
      primaryCategorySlug: profile.primaryCategorySlug,
      primaryCategoryName: categoryNameFromSlug(profile.primaryCategorySlug),
      categorySlugs: categories,
      categoryNames: categories.map(categoryNameFromSlug),
      services: profile.services,
      serviceAreaKeys: profile.serviceAreaKeys,
      serviceAreas: profile.serviceAreaKeys.map(titleFromSlug),
      serviceRadiusMiles: profile.serviceRadiusMiles,
      publicPhone: profile.publicPhone,
      publicEmail: profile.publicEmail,
      websiteUrl: profile.websiteUrl,
      googleBusinessProfileUrl: profile.googleBusinessProfileUrl,
      operatingHours: profile.operatingHours,
      languages: profile.languages,
      yearsInBusiness: profile.yearsInBusiness,
      customerTypes: profile.customerTypes,
      offersFreeEstimates: profile.offersFreeEstimates,
      offersFinancing: profile.offersFinancing,
      emergencyService: profile.emergencyService,
      licenseListed: profile.license.applies && Boolean(profile.license.number),
      insuranceStatus: profile.insurance.status,
      connectMemberBenefit: profile.connectMemberBenefit.enabled ? profile.connectMemberBenefit : { enabled: false, title: null, description: null, type: null, terms: null, expiresAt: null },
      membershipTier: plan.key,
      membershipName: plan.name,
      membershipPriority: plan.placementPriority,
      badgeLabel: plan.badge === "founder" ? "Founding Member" : plan.badge === "preferred" ? "Preferred" : null,
      isFoundingMember: plan.key === "founding_partner",
      searchTokens: normalizeSearchTokens([profile.businessName, ...categories, ...profile.services, ...profile.serviceAreaKeys]),
      matchingKeys: matchingKeys(categories, profile.serviceAreaKeys),
      publicationVersion: Number((await transaction.get(publicRef)).data()?.publicationVersion ?? 0) + 1,
      publishedAt: now,
    };
    const unexpected = Object.keys(publicDocument).filter((key) => !PUBLIC_PROFILE_FIELDS.includes(key as typeof PUBLIC_PROFILE_FIELDS[number]));
    if (unexpected.length) throw new Error(`Unsafe public projection fields: ${unexpected.join(", ")}`);
    transaction.set(publicRef, publicDocument);
    return { published: true, reason: null };
  });
}

export async function reviewFirebaseVendorProfile(input: { user: AppUser; organizationId: string; action: "approve" | "request_changes" | "publish" | "unpublish" | "suspend" | "reactivate"; note?: string | null }, db: Firestore = getPlatformFirestore()) {
  requirePlatformAdmin(input.user);
  if (input.action === "publish") {
    const [organization, profile] = await Promise.all([db.doc(`organizations/${input.organizationId}`).get(), db.doc(`vendorProfiles/${input.organizationId}`).get()]);
    const profileData = profile.data() as VendorProfileDocument | undefined;
    if (!organization.exists || organization.data()?.status !== "active" || !organization.data()?.activeMembershipId || !profileData || profileData.approvalState !== "approved" || !profileData.publicDisplayConsent || !vendorProfileCompleteness(profileData).complete) throw new Error("Vendor is not eligible for publication.");
    const membership = await db.doc(`memberships/${organization.data()!.activeMembershipId}`).get();
    const membershipData = membership.data();
    if (!membershipData || !isOperationalMembership(membershipData)) throw new Error("An operational membership is required for publication.");
    await promoteFirebaseVendorMedia(input.organizationId, db);
  }
  const profileRef = db.doc(`vendorProfiles/${input.organizationId}`);
  const organizationRef = db.doc(`organizations/${input.organizationId}`);
  const now = Timestamp.now();
  await db.runTransaction(async (transaction) => {
    const [profileSnapshot, organizationSnapshot] = await Promise.all([transaction.get(profileRef), transaction.get(organizationRef)]);
    if (!profileSnapshot.exists || !organizationSnapshot.exists) throw new Error("Vendor profile not found.");
    const patch: Record<string, unknown> = { reviewNote: input.note ?? null, reviewedBy: input.user.id, reviewedAt: now, updatedAt: now };
    if (input.action === "approve") patch.approvalState = "approved";
    if (input.action === "request_changes") { patch.approvalState = "changes_requested"; patch.publicationState = "unpublished"; }
    if (input.action === "publish") patch.publicationState = "published";
    if (input.action === "unpublish") patch.publicationState = "unpublished";
    if (input.action === "suspend") { patch.publicationState = "suspended"; transaction.update(organizationRef, { status: "suspended", updatedAt: now }); }
    if (input.action === "reactivate") { patch.publicationState = "unpublished"; transaction.update(organizationRef, { status: "active", updatedAt: now }); }
    transaction.update(profileRef, patch);
  });
  return rebuildPublicMarketplaceProjection(input.organizationId, db);
}

export async function ensureFounderOperationalProfiles(db: Firestore = getPlatformFirestore(), apply = false) {
  const categories = await db.collection("founderCategories").where("status", "==", "claimed").get();
  const operations = [] as Array<{ categorySlug: string; organizationId: string; membershipId: string; businessName: string; action: "create" | "preserve" }>;
  for (const category of categories.docs) {
    const data = category.data();
    if (!data.claimedOrganizationId || !data.membershipId || !data.publicBusinessName) throw new Error(`Claimed Founder category ${category.id} is missing authoritative identifiers.`);
    const profileRef = db.doc(`vendorProfiles/${data.claimedOrganizationId}`);
    const organizationRef = db.doc(`organizations/${data.claimedOrganizationId}`);
    const membershipRef = db.doc(`memberships/${data.membershipId}`);
    const occupancyRef = db.doc(`founderOccupancies/${data.claimedOrganizationId}`);
    const [profile, organization, membership, occupancy] = await Promise.all([profileRef.get(), organizationRef.get(), membershipRef.get(), occupancyRef.get()]);
    if (!organization.exists || !membership.exists || !occupancy.exists) throw new Error(`Founder anchor ${category.id} is incomplete; operationalization will not rebuild it.`);
    if ((organization.data()?.activeMembershipId && organization.data()?.activeMembershipId !== data.membershipId)
      || membership.data()?.organizationId !== data.claimedOrganizationId
      || membership.data()?.categorySlug !== category.id
      || occupancy.data()?.organizationId !== data.claimedOrganizationId
      || occupancy.data()?.membershipId !== data.membershipId
      || occupancy.data()?.categorySlug !== category.id
      || occupancy.data()?.status !== "claimed") throw new Error(`Founder anchor ${category.id} has conflicting identifiers.`);
    operations.push({ categorySlug: category.id, organizationId: data.claimedOrganizationId, membershipId: data.membershipId, businessName: data.publicBusinessName, action: profile.exists ? "preserve" : "create" });
    if (!apply) continue;
    const now = Timestamp.now();
    const batch = db.batch();
    batch.set(organizationRef, { type: "vendor", status: organization.data()?.status ?? "active", activeMembershipId: data.membershipId, updatedAt: now }, { merge: true });
    batch.set(membershipRef, { priority: 30, entitlementsVersion: 1, entitlementSnapshot: getVendorPlanByCode("founding_partner")!.entitlements, updatedAt: now }, { merge: true });
    if (!profile.exists) batch.create(profileRef, emptyVendorProfile({ organizationId: data.claimedOrganizationId, businessName: data.publicBusinessName, categorySlug: category.id }, now));
    await batch.commit();
  }
  return operations;
}

export async function listFirebaseVendorNetwork(db: Firestore = getPlatformFirestore()) {
  const organizations = await db.collection("organizations").where("type", "==", "vendor").limit(500).get();
  return Promise.all(organizations.docs.map(async (organization) => {
    const data = organization.data() as OrganizationDocument;
    const [profile, membership, publicProjection] = await Promise.all([
      db.doc(`vendorProfiles/${organization.id}`).get(),
      data.activeMembershipId ? db.doc(`memberships/${data.activeMembershipId}`).get() : Promise.resolve(null),
      db.doc(`publicMarketplaceVendors/${organization.id}`).get(),
    ]);
    const profileData = profile.data() as VendorProfileDocument | undefined;
    const membershipData = membership?.data() as CommercialMembershipDocument | undefined;
    return { id: organization.id, ...data, profile: profileData ?? null, profileCompleteness: profileData ? vendorProfileCompleteness(profileData) : { complete: false, missing: ["profile"], completed: 0, total: 8 }, membership: membershipData ? { id: membership!.id, ...membershipData } : null, opportunityEligible: publicProjection.exists };
  }));
}
