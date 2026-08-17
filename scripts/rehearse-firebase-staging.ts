import assert from "node:assert/strict";
import type { AppUser } from "../src/domain/auth/types";
import { EMAIL_PROVIDER_STATUS, claimNotificationForDelivery, recordNotificationFailure } from "../src/lib/firebase/notifications";
import {
  assignFirebaseServiceRequest,
  getFirebaseServiceRequestForPm,
  getFirebaseVendorOpportunity,
  listEligibleFirebaseVendors,
  markFirebaseServiceRequestReviewing,
  respondToFirebaseOpportunity,
  submitFirebaseServiceRequest,
  transitionFirebaseServiceRequest,
} from "../src/lib/firebase/service-requests";
import { getMigrationFirestore } from "./firebase-migration/admin";

const projectId = process.env.FIREBASE_PROJECT_ID;
const confirmProject = process.argv.find((value) => value.startsWith("--confirm-project="))?.split("=", 2)[1];
const apply = process.argv.includes("--apply");
if (!projectId || projectId === "optimize-local" || !projectId.includes("staging")) throw new Error("Workflow rehearsal requires a staging Firebase project.");
if (apply && confirmProject !== projectId) throw new Error(`Rehearsal aborted. Pass --confirm-project=${projectId}.`);
if (!apply) {
  process.stdout.write(`${JSON.stringify({ mode: "dry-run", projectId, workflows: ["decline", "reassign", "accept", "in_progress", "complete", "notification_retry"] }, null, 2)}\n`);
  process.exit(0);
}

const db = getMigrationFirestore();
const membership = (id: string, organizationId: string, organizationName: string, organizationType: "property_management" | "vendor") => ({ id, organizationId, organizationName, organizationType, role: "owner" as const });
const admin: AppUser = { id: "staging-super-admin", email: "super-admin@staging.optimizelocal.example", fullName: "Staging Super Admin", avatarUrl: null, isSuperAdmin: true, memberships: [] };
const pm: AppUser = { id: "staging-pm-owner", email: "pm-owner@staging.optimizelocal.example", fullName: "Rockford PM Demo Owner", avatarUrl: null, isSuperAdmin: false, memberships: [membership("staging-pm-access", "staging-pm-rockford", "Rockford Property Management Demo", "property_management")] };
const preferred: AppUser = { id: "staging-preferred-owner", email: "preferred-owner@staging.optimizelocal.example", fullName: "Prairie Electric Demo Owner", avatarUrl: null, isSuperAdmin: false, memberships: [membership("staging-preferred-access", "staging-vendor-preferred", "Prairie Electric Demo", "vendor")] };
const network: AppUser = { id: "staging-network-owner", email: "network-owner@staging.optimizelocal.example", fullName: "River City Plumbing Demo Owner", avatarUrl: null, isSuperAdmin: false, memberships: [membership("staging-network-access", "staging-vendor-network", "River City Plumbing Demo", "vendor")] };

const requestId = await submitFirebaseServiceRequest({
  user: pm,
  organizationId: "staging-pm-rockford",
  propertyId: "staging-property-main",
  categorySlug: "plumbing-sewer",
  categoryName: "Plumbing / Sewer",
  problemDescription: "Synthetic staging leak under the demo kitchen sink.",
  priority: "today",
  contactPreference: "email",
  unit: "Demo 2A",
  contactName: "Staging Property Contact",
  contactEmail: "property-contact@staging.optimizelocal.example",
  accessInstructions: "Staging fixture only; no physical access exists.",
}, db);
await markFirebaseServiceRequestReviewing({ user: admin, requestId, note: "Staging review" }, db);
const candidates = await listEligibleFirebaseVendors({ requestId, user: admin }, db);
assert.deepEqual(candidates.slice(0, 2).map((candidate) => candidate.id), ["staging-vendor-preferred", "staging-vendor-network"]);

const preferredAssignmentId = await assignFirebaseServiceRequest({ user: admin, requestId, vendorOrganizationId: "staging-vendor-preferred" }, db);
const preferredBeforeDecline = await getFirebaseVendorOpportunity(preferred, requestId, db);
assert.equal(preferredBeforeDecline?.private, null);
const declined = await respondToFirebaseOpportunity({ user: preferred, requestId, action: "decline", reason: "Synthetic capacity constraint" }, db);
assert.equal(declined.duplicate, false);
const duplicateDecline = await respondToFirebaseOpportunity({ user: preferred, requestId, action: "decline", reason: "Replay" }, db);
assert.equal(duplicateDecline.duplicate, true);

const eligibleAfterDecline = await listEligibleFirebaseVendors({ requestId, user: admin }, db);
assert.equal(eligibleAfterDecline.some((candidate) => candidate.id === "staging-vendor-preferred"), false);
const networkAssignmentId = await assignFirebaseServiceRequest({ user: admin, requestId, vendorOrganizationId: "staging-vendor-network" }, db);
const activeAssignments = await db.collection("serviceRequestAssignments").where("requestId", "==", requestId).where("status", "==", "assigned").get();
assert.equal(activeAssignments.size, 1);
const networkBeforeAccept = await getFirebaseVendorOpportunity(network, requestId, db);
assert.equal(networkBeforeAccept?.private, null);
const accepted = await respondToFirebaseOpportunity({ user: network, requestId, action: "accept" }, db);
assert.equal(accepted.duplicate, false);
const duplicateAccept = await respondToFirebaseOpportunity({ user: network, requestId, action: "accept" }, db);
assert.equal(duplicateAccept.duplicate, true);
const networkAfterAccept = await getFirebaseVendorOpportunity(network, requestId, db);
assert.equal(networkAfterAccept?.private?.contactEmail, "property-contact@staging.optimizelocal.example");
const declinedVendorAfterReassignment = await getFirebaseVendorOpportunity(preferred, requestId, db);
assert.equal(declinedVendorAfterReassignment?.private, null);

assert.equal((await transitionFirebaseServiceRequest({ user: network, requestId, status: "in_progress", note: "Synthetic work started" }, db)).duplicate, false);
assert.equal((await transitionFirebaseServiceRequest({ user: network, requestId, status: "in_progress" }, db)).duplicate, true);
assert.equal((await transitionFirebaseServiceRequest({ user: network, requestId, status: "completed", note: "Synthetic work completed" }, db)).duplicate, false);
assert.equal((await transitionFirebaseServiceRequest({ user: network, requestId, status: "completed" }, db)).duplicate, true);
const pmView = await getFirebaseServiceRequestForPm(pm, "staging-pm-rockford", requestId, db);
assert.equal(pmView?.request.status, "completed");
assert.equal(pmView?.vendor?.organizationId, "staging-vendor-network");

const notifications = await db.collection("notifications").where("entityId", "==", requestId).get();
const notificationTypes = notifications.docs.map((document) => String(document.data().type)).sort();
assert.deepEqual(notificationTypes, ["opportunity_accepted", "opportunity_assigned", "opportunity_declined", "opportunity_reassigned", "request_completed", "request_in_progress"].sort());
assert.equal(notifications.docs.every((document) => document.data().provider === undefined && document.data().providerMessageId === null), true);
const retryId = notifications.docs.find((document) => document.data().type === "opportunity_assigned")!.id;
assert.ok(await claimNotificationForDelivery(retryId, "staging-worker-1", db));
assert.equal(await claimNotificationForDelivery(retryId, "staging-worker-2", db), null);
await recordNotificationFailure({ id: retryId, errorCode: EMAIL_PROVIDER_STATUS, retryAt: new Date(0) }, db);
assert.ok(await claimNotificationForDelivery(retryId, "staging-worker-2", db));

process.stdout.write(`${JSON.stringify({
  mode: "apply", projectId, requestId, preferredAssignmentId, networkAssignmentId,
  candidateOrder: candidates.slice(0, 2).map((candidate) => candidate.id),
  finalStatus: pmView?.request.status, notifications: notificationTypes, notificationProvider: EMAIL_PROVIDER_STATUS,
  duplicateDecline: duplicateDecline.duplicate, duplicateAccept: duplicateAccept.duplicate,
  privateBeforeAcceptance: networkBeforeAccept?.private === null, privateAfterAcceptance: Boolean(networkAfterAccept?.private),
}, null, 2)}\n`);
