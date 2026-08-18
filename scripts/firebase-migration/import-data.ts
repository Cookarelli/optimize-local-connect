import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { normalizeFounderCategorySlug } from "../../src/domain/founder-categories/catalog";
import { organizationMembershipId, normalizeServiceArea, slugify, stableDigest } from "../../src/lib/firebase/platform";
import { emptyVendorProfile } from "../../src/lib/firebase/vendor-profiles";
import { getMigrationFirestore } from "./admin";
import { migrationChecksum, migrationMode, readJsonFile, report } from "./shared";

const row = z.record(z.string(), z.unknown());
const schema = z.object({
  users: z.array(row).default([]), organizations: z.array(row).default([]), organization_members: z.array(row).default([]), vendor_profiles: z.array(row).default([]),
  properties: z.array(row).default([]), vendor_memberships: z.array(row).default([]), property_manager_service_requests: z.array(row).default([]),
  property_manager_service_request_history: z.array(row).default([]), service_requests: z.array(row).default([]), founderMappings: z.record(z.string(), z.string()).default({}),
  founderMembershipMappings: z.record(z.string(), z.string()).default({}),
});
type PlannedWrite = { path: string; data: Record<string, unknown> };

const mode = migrationMode();
const raw = await readJsonFile(mode.path);
const data = schema.parse(raw);
const db = getMigrationFirestore();
const migrationNow = Timestamp.now();
const conflicts: string[] = [];
const warnings: string[] = [];
const writes: PlannedWrite[] = [];
const mappedOrg = (legacy: string) => data.founderMappings[legacy] ?? legacy;
const mappedMembership = (legacy: string) => data.founderMembershipMappings[legacy] ?? legacy;
const importedCategory = (value: unknown, fallback: string | null) => {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") throw new Error("Imported category slug must be a string.");
  return normalizeFounderCategorySlug(value);
};
const sourceTimestamp = (value: unknown) => {
  if (typeof value !== "string") return migrationNow;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? migrationNow : Timestamp.fromDate(date);
};
const currentStatuses = new Set(["active", "trialing", "past_due", "complimentary", "manually_granted"]);
const currentMembershipByOrganization = new Map<string, { id: string; pending: boolean }>();

for (const membership of data.vendor_memberships) {
  if (typeof membership.id !== "string" || typeof membership.vendor_organization_id !== "string") continue;
  const organizationId = mappedOrg(membership.vendor_organization_id);
  const status = String(membership.status ?? "pending");
  const existing = currentMembershipByOrganization.get(organizationId);
  if (currentStatuses.has(status) || (!existing && status === "pending")) currentMembershipByOrganization.set(organizationId, { id: mappedMembership(membership.id), pending: !currentStatuses.has(status) });
}

for (const user of data.users) {
  if (typeof user.id !== "string") { warnings.push("user_without_id"); continue; }
  writes.push({ path: `users/${user.id}`, data: { email: user.email ?? null, displayName: user.full_name ?? null, avatarUrl: user.avatar_url ?? null, status: "active", legacySupabaseUserId: user.id, updatedAt: migrationNow, createdAt: sourceTimestamp(user.created_at) } });
}
for (const organization of data.organizations) {
  if (typeof organization.id !== "string" || typeof organization.name !== "string") { warnings.push("organization_without_required_identity"); continue; }
  const id = mappedOrg(organization.id);
  const currentMembership = currentMembershipByOrganization.get(id);
  writes.push({ path: `organizations/${id}`, data: {
    type: organization.type === "property_management" ? "property_manager" : "vendor", status: organization.status === "suspended" ? "suspended" : organization.status === "active" ? "active" : "pending",
    name: organization.name, normalizedName: organization.name.toLowerCase(), slug: typeof organization.slug === "string" ? organization.slug : slugify(organization.name), legalName: organization.legal_name ?? null,
    primaryEmail: organization.email ?? null, primaryPhone: organization.phone ?? null, websiteUrl: organization.website_url ?? null,
    activeMembershipId: currentMembership && !currentMembership.pending ? currentMembership.id : null, pendingMembershipId: currentMembership?.pending ? currentMembership.id : null,
    legacyIds: { supabaseOrganizationId: organization.id }, updatedAt: migrationNow, createdAt: sourceTimestamp(organization.created_at),
  } });
}
for (const access of data.organization_members) {
  if (typeof access.organization_id !== "string" || typeof access.user_id !== "string") { warnings.push("organization_access_without_required_identity"); continue; }
  const organizationId = mappedOrg(access.organization_id);
  const role = access.role === "property_manager" ? "manager" : access.role === "future_resident" ? "staff" : access.role;
  writes.push({ path: `organizationMemberships/${organizationMembershipId(organizationId, access.user_id)}`, data: {
    organizationId, userId: access.user_id, organizationType: access.organization_type === "property_management" ? "property_manager" : access.organization_type ?? "vendor", role,
    status: access.status ?? "active", legacySupabaseMembershipId: access.id ?? null, invitedAt: access.invited_at ? sourceTimestamp(access.invited_at) : null,
    acceptedAt: sourceTimestamp(access.accepted_at ?? access.created_at), createdAt: sourceTimestamp(access.created_at), updatedAt: migrationNow,
  } });
}
for (const profile of data.vendor_profiles) {
  if (typeof profile.organization_id !== "string") { warnings.push("vendor_profile_without_organization"); continue; }
  const organizationId = mappedOrg(profile.organization_id);
  writes.push({ path: `vendorProfiles/${organizationId}`, data: {
    ...emptyVendorProfile({ organizationId, businessName: String(profile.business_name ?? profile.name ?? "Vendor") }, migrationNow), description: String(profile.description ?? ""),
    publicEmail: profile.public_email ?? null, publicPhone: profile.phone ?? null, websiteUrl: profile.website_url ?? null, approvalState: profile.approval_status ?? "pending",
    publicationState: "unpublished", publicDisplayConsent: Boolean(profile.public_display_consent), legacySupabaseProfileId: profile.id ?? null, updatedAt: migrationNow,
  } });
}
for (const property of data.properties) {
  if (typeof property.id !== "string" || typeof property.organization_id !== "string") { warnings.push("property_without_required_identity"); continue; }
  const city = String(property.city ?? ""); const stateCode = String(property.state_code ?? "").toUpperCase();
  writes.push({ path: `properties/${property.id}`, data: {
    organizationId: mappedOrg(property.organization_id), name: property.name ?? "Property", address: { line1: property.address_line_1 ?? "", line2: property.address_line_2 ?? null, city, stateCode, postalCode: property.postal_code ?? "" },
    serviceAreaKey: property.service_area_key ?? normalizeServiceArea(`${city}-${stateCode}`), status: property.status ?? "active", legacySupabasePropertyId: property.id,
    createdBy: property.created_by ?? "migration", createdAt: sourceTimestamp(property.created_at), updatedAt: migrationNow,
  } });
}
for (const membership of data.vendor_memberships) {
  if (typeof membership.id !== "string" || typeof membership.vendor_organization_id !== "string") { warnings.push("commercial_membership_without_required_identity"); continue; }
  const id = mappedMembership(membership.id); const tier = membership.tier ?? membership.level_code ?? "network";
  const priority = membership.priority ?? (tier === "founding_partner" ? 30 : tier === "preferred" ? 20 : 10);
  const hasStripeReference = Boolean(membership.stripe_customer_id || membership.external_subscription_id || membership.stripe_price_id || membership.stripe_checkout_session_id);
  const categorySlug = importedCategory(membership.category_slug, null);
  writes.push({ path: `memberships/${id}`, data: {
    organizationId: mappedOrg(membership.vendor_organization_id), tier, priority, status: membership.status ?? "pending", categorySlug,
    paymentSource: membership.source ?? (hasStripeReference ? "stripe" : null), listPriceCents: membership.list_price_cents ?? membership.amount_cents ?? 0,
    actualAmountPaidCents: membership.actual_amount_paid_cents ?? null, currency: membership.currency ?? "USD",
    stripe: hasStripeReference ? { customerId: membership.stripe_customer_id ?? null, checkoutSessionId: membership.stripe_checkout_session_id ?? null, subscriptionId: membership.external_subscription_id ?? null, priceId: membership.stripe_price_id ?? null } : null,
    paypal: membership.paypal_reference_id ? { referenceId: membership.paypal_reference_id } : null, currentPeriodEndsAt: membership.current_period_ends_at ? sourceTimestamp(membership.current_period_ends_at) : null,
    cancelAtPeriodEnd: Boolean(membership.cancel_at_period_end), checkoutAttemptNumber: Number(membership.checkout_attempt_number ?? 0), entitlementsVersion: 1, entitlementSnapshot: {},
    legacySupabaseMembershipId: membership.id, createdAt: sourceTimestamp(membership.created_at), updatedAt: migrationNow,
  } });
}
for (const request of data.property_manager_service_requests) {
  if (typeof request.id !== "string" || typeof request.organization_id !== "string") { warnings.push("request_without_required_identity"); continue; }
  const assignedVendor = typeof request.assigned_vendor_organization_id === "string" ? mappedOrg(request.assigned_vendor_organization_id) : null;
  const acceptedVendor = typeof request.accepted_vendor_organization_id === "string" ? mappedOrg(request.accepted_vendor_organization_id) : null;
  const assignmentId = assignedVendor ? `assignment_${stableDigest(`${request.id}|${assignedVendor}|migration`)}` : null;
  const categorySlug = importedCategory(request.category_slug, "migration-review")!;
  const rawStatus = String(request.status ?? "submitted"); const status = rawStatus === "cancelled" ? "canceled" : acceptedVendor && ["assigned", "accepted"].includes(rawStatus) ? "accepted" : rawStatus;
  writes.push({ path: `serviceRequests/${request.id}`, data: {
    propertyManagerOrganizationId: mappedOrg(request.organization_id), propertyId: request.property_id ?? "migration-review", propertyName: request.manual_property_name ?? request.property_name ?? "Property",
    categorySlug, categoryName: request.category_name ?? "Migration review", serviceAreaKey: request.service_area_key ?? "migration-review",
    problemDescription: request.problem_description ?? "", priority: request.priority ?? "flexible", contactPreference: request.preferred_contact ?? "email", status,
    activeAssignmentId: assignmentId, lastAssignmentId: assignmentId, acceptedVendorOrganizationId: acceptedVendor, acceptedVendorName: request.accepted_vendor_name ?? null,
    declinedVendorOrganizationIds: request.declined_vendor_organization_id ? [mappedOrg(String(request.declined_vendor_organization_id))] : [], submittedBy: request.requested_by ?? "migration",
    submittedAt: sourceTimestamp(request.submitted_at ?? request.created_at), updatedAt: migrationNow, completedAt: status === "completed" ? sourceTimestamp(request.completed_at) : null,
    canceledAt: status === "canceled" ? sourceTimestamp(request.cancelled_at ?? request.canceled_at) : null, legacySupabaseRequestId: request.id,
  } });
  writes.push({ path: `serviceRequestPrivate/${request.id}`, data: {
    propertyManagerOrganizationId: mappedOrg(request.organization_id), acceptedVendorOrganizationId: acceptedVendor, exactAddress: request.address ?? "", unit: request.unit ?? null,
    contactName: request.property_manager_contact_name ?? "Property contact", contactPhone: request.contact_phone ?? null, contactEmail: request.contact_email ?? null,
    accessInstructions: request.access_instructions ?? null, attachmentPaths: [], createdAt: sourceTimestamp(request.created_at), updatedAt: migrationNow,
  } });
  if (assignmentId && assignedVendor) writes.push({ path: `serviceRequestAssignments/${assignmentId}`, data: {
    requestId: request.id, propertyManagerOrganizationId: mappedOrg(request.organization_id), vendorOrganizationId: assignedVendor, vendorName: request.assigned_vendor_name ?? request.accepted_vendor_name ?? "Assigned vendor",
    categorySlug, serviceAreaKey: request.service_area_key ?? "migration-review", status: acceptedVendor ? "accepted" : "assigned",
    assignedBy: request.assigned_by ?? "migration", assignedAt: sourceTimestamp(request.assigned_at), respondedAt: acceptedVendor ? sourceTimestamp(request.accepted_at) : null,
    responseNote: null, revokedAt: null, createdAt: sourceTimestamp(request.assigned_at), updatedAt: migrationNow,
  } });
}
for (const history of data.property_manager_service_request_history) {
  const requestId = typeof history.request_id === "string" ? history.request_id : null;
  if (!requestId) { warnings.push("request_history_without_request"); continue; }
  const sourceId = typeof history.id === "string" ? history.id : stableDigest(`${requestId}|${String(history.created_at)}|${String(history.status)}|${String(history.note)}`);
  const rawStatus = String(history.status ?? "submitted"); const status = rawStatus === "cancelled" ? "canceled" : rawStatus;
  writes.push({ path: `serviceRequests/${requestId}/events/migration_${stableDigest(sourceId)}`, data: {
    type: history.event_type ?? status, status, actorUserId: history.actor_user_id ?? "migration", actorOrganizationId: history.actor_organization_id ? mappedOrg(String(history.actor_organization_id)) : null,
    note: history.note ?? null, vendorVisible: Boolean(history.vendor_visible), createdAt: sourceTimestamp(history.created_at), legacySupabaseHistoryId: history.id ?? null,
  } });
}

const pathOwners = new Set<string>();
for (const write of writes) { if (pathOwners.has(write.path)) conflicts.push(`${write.path}:duplicate_source_mapping`); pathOwners.add(write.path); }
const founderOrganizationIds = new Set(Object.values(data.founderMappings)); const founderMembershipIds = new Set(Object.values(data.founderMembershipMappings));
const existingFirestoreWins = new Set<string>();
const protectedWrites = writes.filter((write) => { const [collection, id] = write.path.split("/"); return (collection === "organizations" && founderOrganizationIds.has(id!)) || (collection === "memberships" && founderMembershipIds.has(id!)) || (collection === "vendorProfiles" && founderOrganizationIds.has(id!)); });
for (let index = 0; index < protectedWrites.length; index += 200) {
  const chunk = protectedWrites.slice(index, index + 200); const snapshots = await db.getAll(...chunk.map((write) => db.doc(write.path)));
  snapshots.forEach((snapshot, offset) => { if (snapshot.exists) { existingFirestoreWins.add(chunk[offset]!.path); conflicts.push(`${chunk[offset]!.path}:existing_firestore_wins`); } });
}
if (mode.apply) for (const write of writes) { if (!existingFirestoreWins.has(write.path)) await db.doc(write.path).set(write.data, { merge: true }); }

const sourceCounts = Object.fromEntries(Object.entries(data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length]));
const writeCounts = writes.reduce<Record<string, number>>((counts, write) => { const collection = write.path.split("/")[0]!; counts[collection] = (counts[collection] ?? 0) + 1; return counts; }, {});
function stableManifestValue(value: unknown): unknown {
  if (value instanceof Timestamp) return "<firestore-timestamp>";
  if (Array.isArray(value)) return value.map(stableManifestValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, stableManifestValue(item)]));
  return value;
}
report({ manifestVersion: 1, mode: mode.apply ? "apply" : "dry-run", sourceChecksum: migrationChecksum(raw), plannedWritesChecksum: migrationChecksum(writes.map((write) => ({ path: write.path, data: stableManifestValue(write.data) }))), sourceCounts, writeCounts,
  plannedWrites: writes.length, appliedWrites: mode.apply ? writes.length - existingFirestoreWins.size : 0, ignoredLegacyRequestRows: data.service_requests.length,
  requestModelImported: "property_manager_service_requests", conflicts, warnings });
