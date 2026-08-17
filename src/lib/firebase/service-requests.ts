import "server-only";

import { randomUUID } from "node:crypto";
import { Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { AppUser } from "@/src/domain/auth/types";
import type { PublicMarketplaceVendorDocument, ServiceRequestAssignmentDocument, ServiceRequestDocument, ServiceRequestEventDocument, ServiceRequestPrivateDocument, ServiceRequestPriority, ServiceRequestStatus } from "@/src/domain/firebase-platform/types";
import { getPlatformFirestore } from "@/src/lib/firebase/admin";
import { requireOrganizationMembership, requirePlatformAdmin } from "@/src/lib/firebase/authorization";
import { setNotificationInTransaction, type NotificationType } from "@/src/lib/firebase/notifications";
import { normalizedText, slugify } from "@/src/lib/firebase/platform";
import { FOUNDER_CATEGORY_CATALOG, isFounderCategorySlug } from "@/src/domain/founder-categories/catalog";

function requestEvent(transaction: Transaction, db: Firestore, requestId: string, input: { type: string; status: ServiceRequestStatus; actorUserId: string; actorOrganizationId: string | null; note?: string | null; vendorVisible?: boolean }) {
  const now = Timestamp.now();
  transaction.create(db.doc(`serviceRequests/${requestId}/events/${randomUUID()}`), { ...input, note: input.note ?? null, vendorVisible: input.vendorVisible ?? false, createdAt: now });
}

export async function submitFirebaseServiceRequest(input: {
  user: AppUser;
  organizationId: string;
  propertyId: string;
  categorySlug: string;
  categoryName: string;
  problemDescription: string;
  priority: ServiceRequestPriority;
  contactPreference: "phone" | "email";
  unit?: string | null;
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  accessInstructions?: string | null;
}, db: Firestore = getPlatformFirestore()) {
  requireOrganizationMembership(input.user, input.organizationId, ["owner", "admin", "manager", "staff", "property_manager"]);
  const categorySlug = slugify(input.categorySlug);
  if (!isFounderCategorySlug(categorySlug)) throw new Error("Service category is unavailable.");
  const categoryName = FOUNDER_CATEGORY_CATALOG.find((category) => category.slug === categorySlug)!.displayName;
  if (input.contactPreference === "phone" && !input.contactPhone) throw new Error("Phone is required when phone is preferred.");
  if (input.contactPreference === "email" && !input.contactEmail) throw new Error("Email is required when email is preferred.");
  const [property, organization] = await Promise.all([db.doc(`properties/${input.propertyId}`).get(), db.doc(`organizations/${input.organizationId}`).get()]);
  const propertyData = property.data();
  if (!organization.exists || organization.data()?.type !== "property_manager" || organization.data()?.status !== "active") throw new Error("Property-management organization is unavailable.");
  if (!propertyData || propertyData.organizationId !== input.organizationId || propertyData.status !== "active") throw new Error("Property is unavailable.");
  const requestId = randomUUID();
  const now = Timestamp.now();
  const safe: ServiceRequestDocument = {
    propertyManagerOrganizationId: input.organizationId,
    propertyId: input.propertyId,
    propertyName: propertyData.name,
    categorySlug,
    categoryName,
    serviceAreaKey: propertyData.serviceAreaKey,
    problemDescription: normalizedText(input.problemDescription),
    priority: input.priority,
    contactPreference: input.contactPreference,
    status: "submitted",
    activeAssignmentId: null,
    lastAssignmentId: null,
    acceptedVendorOrganizationId: null,
    acceptedVendorName: null,
    declinedVendorOrganizationIds: [],
    submittedBy: input.user.id,
    submittedAt: now,
    updatedAt: now,
    completedAt: null,
    canceledAt: null,
  };
  const privateData: ServiceRequestPrivateDocument = {
    propertyManagerOrganizationId: input.organizationId,
    acceptedVendorOrganizationId: null,
    exactAddress: [propertyData.address.line1, propertyData.address.line2, `${propertyData.address.city}, ${propertyData.address.stateCode} ${propertyData.address.postalCode}`].filter(Boolean).join(", "),
    unit: input.unit ? normalizedText(input.unit) : null,
    contactName: normalizedText(input.contactName),
    contactPhone: input.contactPhone?.trim() ?? null,
    contactEmail: input.contactEmail?.trim().toLowerCase() ?? null,
    accessInstructions: input.accessInstructions ? normalizedText(input.accessInstructions) : null,
    attachmentPaths: [],
    createdAt: now,
    updatedAt: now,
  };
  const batch = db.batch();
  batch.create(db.doc(`serviceRequests/${requestId}`), safe);
  batch.create(db.doc(`serviceRequestPrivate/${requestId}`), privateData);
  batch.create(db.doc(`serviceRequests/${requestId}/events/${randomUUID()}`), { type: "submitted", status: "submitted", actorUserId: input.user.id, actorOrganizationId: input.organizationId, note: "Request submitted", vendorVisible: false, createdAt: now });
  await batch.commit();
  return requestId;
}

export async function listEligibleFirebaseVendors(input: { requestId: string; user: AppUser }, db: Firestore = getPlatformFirestore()) {
  requirePlatformAdmin(input.user);
  const request = await db.doc(`serviceRequests/${input.requestId}`).get();
  const data = request.data() as ServiceRequestDocument | undefined;
  if (!data) throw new Error("Request not found.");
  const key = `${data.categorySlug}|${data.serviceAreaKey}`;
  const matches = await db.collection("publicMarketplaceVendors").where("matchingKeys", "array-contains", key).limit(100).get();
  return matches.docs.map((document) => ({ id: document.id, ...(document.data() as PublicMarketplaceVendorDocument) })).filter((vendor) => !data.declinedVendorOrganizationIds.includes(vendor.id)).sort((left, right) => right.membershipPriority - left.membershipPriority);
}

export async function assignFirebaseServiceRequest(input: { user: AppUser; requestId: string; vendorOrganizationId: string; note?: string | null }, db: Firestore = getPlatformFirestore()) {
  requirePlatformAdmin(input.user);
  const requestRef = db.doc(`serviceRequests/${input.requestId}`);
  const vendorRef = db.doc(`publicMarketplaceVendors/${input.vendorOrganizationId}`);
  const assignmentId = randomUUID();
  const assignmentRef = db.doc(`serviceRequestAssignments/${assignmentId}`);
  const now = Timestamp.now();
  return db.runTransaction(async (transaction) => {
    const [requestSnapshot, vendorSnapshot, activeAssignments] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(vendorRef),
      transaction.get(db.collection("serviceRequestAssignments").where("requestId", "==", input.requestId).where("status", "==", "assigned")),
    ]);
    const request = requestSnapshot.data() as ServiceRequestDocument | undefined;
    const vendor = vendorSnapshot.data();
    if (!request || !["submitted", "reviewing", "assigned"].includes(request.status)) throw new Error("Request cannot be assigned in its current state.");
    if (!vendor || !((vendor.matchingKeys as string[] | undefined) ?? []).includes(`${request.categorySlug}|${request.serviceAreaKey}`) || request.declinedVendorOrganizationIds.includes(input.vendorOrganizationId)) throw new Error("Vendor is not eligible for this request.");
    for (const activeAssignment of activeAssignments.docs) transaction.update(activeAssignment.ref, { status: "revoked", revokedAt: now, updatedAt: now });
    transaction.create(assignmentRef, { requestId: input.requestId, propertyManagerOrganizationId: request.propertyManagerOrganizationId, vendorOrganizationId: input.vendorOrganizationId, vendorName: vendor.businessName, categorySlug: request.categorySlug, serviceAreaKey: request.serviceAreaKey, status: "assigned", assignedBy: input.user.id, assignedAt: now, respondedAt: null, responseNote: null, revokedAt: null, createdAt: now, updatedAt: now });
    transaction.update(requestRef, { status: "assigned", activeAssignmentId: assignmentId, lastAssignmentId: assignmentId, acceptedVendorOrganizationId: null, acceptedVendorName: null, updatedAt: now });
    const reassigned = !activeAssignments.empty || Boolean(request.lastAssignmentId);
    requestEvent(transaction, db, input.requestId, { type: reassigned ? "reassigned" : "assigned", status: "assigned", actorUserId: input.user.id, actorOrganizationId: null, note: reassigned ? "Opportunity reassigned" : "Opportunity assigned", vendorVisible: true });
    if (input.note?.trim()) requestEvent(transaction, db, input.requestId, { type: "admin_note", status: "assigned", actorUserId: input.user.id, actorOrganizationId: null, note: input.note.trim(), vendorVisible: false });
    setNotificationInTransaction(transaction, { type: reassigned ? "opportunity_reassigned" : "opportunity_assigned", entityId: input.requestId, version: assignmentId, recipientOrganizationId: input.vendorOrganizationId, templateKey: "vendor-opportunity", templateData: { requestId: input.requestId, category: request.categoryName, serviceArea: request.serviceAreaKey } }, db);
    return assignmentId;
  });
}

export async function markFirebaseServiceRequestReviewing(input: { user: AppUser; requestId: string; note?: string | null }, db: Firestore = getPlatformFirestore()) {
  requirePlatformAdmin(input.user);
  const ref = db.doc(`serviceRequests/${input.requestId}`);
  const now = Timestamp.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const request = snapshot.data() as ServiceRequestDocument | undefined;
    if (!request) throw new Error("Request not found.");
    if (request.status === "reviewing") return;
    if (request.status !== "submitted") throw new Error("Only a submitted request can enter review.");
    transaction.update(ref, { status: "reviewing", updatedAt: now });
    requestEvent(transaction, db, input.requestId, { type: "reviewing", status: "reviewing", actorUserId: input.user.id, actorOrganizationId: null, note: input.note, vendorVisible: false });
  });
}

export async function respondToFirebaseOpportunity(input: { user: AppUser; requestId: string; action: "accept" | "decline"; reason?: string | null }, db: Firestore = getPlatformFirestore()) {
  const requestRef = db.doc(`serviceRequests/${input.requestId}`);
  const privateRef = db.doc(`serviceRequestPrivate/${input.requestId}`);
  return db.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    const request = requestSnapshot.data() as ServiceRequestDocument | undefined;
    const assignmentId = request?.activeAssignmentId ?? (input.action === "decline" ? request?.lastAssignmentId : null);
    if (!request || !assignmentId) throw new Error("Opportunity is unavailable.");
    const assignmentRef = db.doc(`serviceRequestAssignments/${assignmentId}`);
    const [assignmentSnapshot, privateSnapshot] = await Promise.all([transaction.get(assignmentRef), transaction.get(privateRef)]);
    const assignment = assignmentSnapshot.data();
    if (!assignment) throw new Error("Opportunity is unavailable.");
    const vendor = input.user.memberships.find((membership) => membership.organizationType === "vendor" && membership.organizationId === assignment.vendorOrganizationId && ["owner", "admin", "vendor", "technician"].includes(membership.role));
    if (!vendor) throw new Error("Opportunity is unavailable.");
    const vendorProjectionSnapshot = await transaction.get(db.doc(`publicMarketplaceVendors/${vendor.organizationId}`));
    if (input.action === "accept" && assignment.status === "accepted" && request.acceptedVendorOrganizationId === vendor.organizationId) return { duplicate: true, status: "accepted" as const };
    if (input.action === "decline" && assignment.status === "declined") return { duplicate: true, status: "declined" as const };
    if (assignment.status !== "assigned" || request.status !== "assigned") throw new Error("Opportunity has already been resolved.");
    const now = Timestamp.now();
    if (input.action === "accept") {
      if (!vendorProjectionSnapshot.exists) throw new Error("An eligible published membership is required to accept this opportunity.");
      transaction.update(assignmentRef, { status: "accepted", respondedAt: now, responseNote: null, updatedAt: now });
      transaction.update(requestRef, { status: "accepted", acceptedVendorOrganizationId: vendor.organizationId, acceptedVendorName: assignment.vendorName, updatedAt: now });
      if (!privateSnapshot.exists) throw new Error("Private request details are missing.");
      transaction.update(privateRef, { acceptedVendorOrganizationId: vendor.organizationId, updatedAt: now });
      requestEvent(transaction, db, input.requestId, { type: "accepted", status: "accepted", actorUserId: input.user.id, actorOrganizationId: vendor.organizationId, note: "Vendor accepted opportunity", vendorVisible: true });
      setNotificationInTransaction(transaction, { type: "opportunity_accepted", entityId: input.requestId, version: assignmentId, recipientOrganizationId: request.propertyManagerOrganizationId, templateKey: "opportunity-accepted", templateData: { requestId: input.requestId, vendorName: assignment.vendorName } }, db);
      return { duplicate: false, status: "accepted" as const };
    }
    transaction.update(assignmentRef, { status: "declined", respondedAt: now, responseNote: input.reason?.trim() ?? null, updatedAt: now });
    transaction.update(requestRef, { status: "reviewing", activeAssignmentId: null, lastAssignmentId: assignmentId, declinedVendorOrganizationIds: [...new Set([...request.declinedVendorOrganizationIds, vendor.organizationId])], updatedAt: now });
    requestEvent(transaction, db, input.requestId, { type: "declined", status: "reviewing", actorUserId: input.user.id, actorOrganizationId: vendor.organizationId, note: input.reason, vendorVisible: false });
    setNotificationInTransaction(transaction, { type: "opportunity_declined", entityId: input.requestId, version: assignmentId, recipientOrganizationId: request.propertyManagerOrganizationId, templateKey: "opportunity-declined", templateData: { requestId: input.requestId, vendorName: assignment.vendorName } }, db);
    return { duplicate: false, status: "declined" as const };
  });
}

export async function transitionFirebaseServiceRequest(input: { user: AppUser; requestId: string; status: "in_progress" | "completed" | "canceled"; note?: string | null }, db: Firestore = getPlatformFirestore()) {
  const requestRef = db.doc(`serviceRequests/${input.requestId}`);
  const now = Timestamp.now();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    const request = snapshot.data() as ServiceRequestDocument | undefined;
    if (!request) throw new Error("Request not found.");
    const isAdmin = input.user.isSuperAdmin;
    const pmAccess = input.user.memberships.find((item) => item.organizationId === request.propertyManagerOrganizationId && ["owner", "admin", "manager", "property_manager"].includes(item.role));
    const vendorAccess = request.acceptedVendorOrganizationId ? input.user.memberships.find((item) => item.organizationId === request.acceptedVendorOrganizationId && ["owner", "admin", "vendor", "technician"].includes(item.role)) : undefined;
    const pmMember = Boolean(pmAccess);
    const vendorMember = Boolean(vendorAccess);
    if (!isAdmin && !pmMember && !vendorMember) throw new Error("Request access required.");
    if (input.status === "canceled" && !isAdmin && !pmMember) throw new Error("Only the property-management organization can cancel this request.");
    const allowed = input.status === "in_progress" ? request.status === "accepted" : input.status === "completed" ? request.status === "in_progress" : !["completed", "canceled"].includes(request.status);
    if (request.status === input.status) return { duplicate: true };
    if (!allowed) throw new Error("Invalid request state transition.");
    const patch: Record<string, unknown> = { status: input.status, updatedAt: now };
    if (input.status === "completed") patch.completedAt = now;
    if (input.status === "canceled") patch.canceledAt = now;
    transaction.update(requestRef, patch);
    requestEvent(transaction, db, input.requestId, { type: input.status, status: input.status, actorUserId: input.user.id, actorOrganizationId: vendorMember ? request.acceptedVendorOrganizationId : request.propertyManagerOrganizationId, note: input.note, vendorVisible: true });
    const notificationType = input.status === "in_progress" ? "request_in_progress" : input.status === "completed" ? "request_completed" : null;
    if (notificationType) setNotificationInTransaction(transaction, { type: notificationType as NotificationType, entityId: input.requestId, version: input.status, recipientOrganizationId: request.propertyManagerOrganizationId, templateKey: notificationType, templateData: { requestId: input.requestId, status: input.status } }, db);
    return { duplicate: false };
  });
}

export async function listFirebaseServiceRequestsForPm(user: AppUser, organizationId: string, db: Firestore = getPlatformFirestore()) {
  requireOrganizationMembership(user, organizationId);
  const snapshot = await db.collection("serviceRequests").where("propertyManagerOrganizationId", "==", organizationId).orderBy("submittedAt", "desc").limit(100).get();
  return snapshot.docs.map((document) => ({ id: document.id, ...(document.data() as ServiceRequestDocument) }));
}

export async function getFirebaseServiceRequestForPm(user: AppUser, organizationId: string, requestId: string, db: Firestore = getPlatformFirestore()) {
  requireOrganizationMembership(user, organizationId);
  const requestRef = db.doc(`serviceRequests/${requestId}`);
  const [requestSnapshot, privateSnapshot, eventsSnapshot] = await Promise.all([
    requestRef.get(),
    db.doc(`serviceRequestPrivate/${requestId}`).get(),
    requestRef.collection("events").orderBy("createdAt").get(),
  ]);
  const request = requestSnapshot.data() as ServiceRequestDocument | undefined;
  if (!request || request.propertyManagerOrganizationId !== organizationId) return null;
  const privateData = privateSnapshot.data() as ServiceRequestPrivateDocument | undefined;
  if (!privateData || privateData.propertyManagerOrganizationId !== organizationId) throw new Error("Private request data is unavailable.");
  const vendorSnapshot = request.acceptedVendorOrganizationId
    ? await db.doc(`publicMarketplaceVendors/${request.acceptedVendorOrganizationId}`).get()
    : null;
  const vendor = vendorSnapshot?.exists ? vendorSnapshot.data() as Record<string, unknown> : null;
  return {
    request: { id: requestSnapshot.id, ...request },
    private: privateData,
    vendor: vendor ? {
      organizationId: request.acceptedVendorOrganizationId!,
      businessName: String(vendor.businessName ?? request.acceptedVendorName ?? "Accepted provider"),
      slug: typeof vendor.slug === "string" ? vendor.slug : null,
      publicPhone: typeof vendor.publicPhone === "string" ? vendor.publicPhone : null,
      publicEmail: typeof vendor.publicEmail === "string" ? vendor.publicEmail : null,
    } : request.acceptedVendorOrganizationId ? {
      organizationId: request.acceptedVendorOrganizationId,
      businessName: request.acceptedVendorName ?? "Accepted provider",
      slug: null,
      publicPhone: null,
      publicEmail: null,
    } : null,
    events: eventsSnapshot.docs.map((event) => ({ id: event.id, ...(event.data() as ServiceRequestEventDocument) })).filter((event) => event.type !== "admin_note"),
  };
}

export async function listFirebaseVendorOpportunities(user: AppUser, organizationId: string, db: Firestore = getPlatformFirestore()) {
  requireOrganizationMembership(user, organizationId, ["owner", "admin", "vendor", "technician"]);
  const assignments = await db.collection("serviceRequestAssignments").where("vendorOrganizationId", "==", organizationId).orderBy("assignedAt", "desc").limit(100).get();
  const requestIds = [...new Set(assignments.docs.map((document) => document.data().requestId as string))];
  const requests = requestIds.length ? await db.getAll(...requestIds.map((id) => db.doc(`serviceRequests/${id}`))) : [];
  const requestMap = new Map(requests.filter((item) => item.exists).map((item) => [item.id, item.data() as ServiceRequestDocument]));
  return assignments.docs.map((document) => {
    const assignment = document.data() as ServiceRequestAssignmentDocument;
    return { id: document.id, ...assignment, request: requestMap.get(assignment.requestId) ?? null };
  }).filter((item): item is typeof item & { request: ServiceRequestDocument } => Boolean(item.request));
}

export async function getFirebaseVendorOpportunity(user: AppUser, requestId: string, db: Firestore = getPlatformFirestore()) {
  const vendorOrganizationIds = new Set(user.memberships.filter((membership) => membership.organizationType === "vendor" && ["owner", "admin", "vendor", "technician"].includes(membership.role)).map((membership) => membership.organizationId));
  if (!vendorOrganizationIds.size) return null;
  const request = await db.doc(`serviceRequests/${requestId}`).get();
  const requestData = request.data() as ServiceRequestDocument | undefined;
  if (!requestData) return null;
  const assignments = await db.collection("serviceRequestAssignments").where("requestId", "==", requestId).limit(100).get();
  const assignment = assignments.docs.filter((document) => vendorOrganizationIds.has(document.data().vendorOrganizationId)).sort((left, right) => {
    const leftCurrent = Number(left.id === requestData.activeAssignmentId || left.data().vendorOrganizationId === requestData.acceptedVendorOrganizationId);
    const rightCurrent = Number(right.id === requestData.activeAssignmentId || right.data().vendorOrganizationId === requestData.acceptedVendorOrganizationId);
    return rightCurrent - leftCurrent || Number(right.data().assignedAt?.toMillis?.() ?? 0) - Number(left.data().assignedAt?.toMillis?.() ?? 0);
  })[0];
  if (!assignment) return null;
  const accepted = requestData.acceptedVendorOrganizationId === assignment.data().vendorOrganizationId && assignment.data().status === "accepted";
  const [privateSnapshot, events] = await Promise.all([
    accepted ? db.doc(`serviceRequestPrivate/${requestId}`).get() : Promise.resolve(null),
    db.collection(`serviceRequests/${requestId}/events`).where("vendorVisible", "==", true).orderBy("createdAt").get(),
  ]);
  return {
    request: { id: request.id, ...requestData },
    assignment: { id: assignment.id, ...(assignment.data() as ServiceRequestAssignmentDocument) },
    private: accepted ? privateSnapshot?.data() as ServiceRequestPrivateDocument : null,
    events: events.docs.map((event) => ({ id: event.id, ...(event.data() as ServiceRequestEventDocument) })),
  };
}

export async function listFirebaseServiceRequestsForAdmin(user: AppUser, db: Firestore = getPlatformFirestore()) {
  requirePlatformAdmin(user);
  const snapshot = await db.collection("serviceRequests").orderBy("submittedAt", "desc").limit(200).get();
  return snapshot.docs.map((document) => ({ id: document.id, ...(document.data() as ServiceRequestDocument) }));
}
