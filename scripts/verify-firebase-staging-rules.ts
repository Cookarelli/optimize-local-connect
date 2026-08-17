import assert from "node:assert/strict";
import type { AppUser } from "../src/domain/auth/types";
import { assignFirebaseServiceRequest, markFirebaseServiceRequestReviewing, submitFirebaseServiceRequest } from "../src/lib/firebase/service-requests";
import { getMigrationFirestore } from "./firebase-migration/admin";

const projectId = process.env.FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const password = process.env.FIREBASE_STAGING_TEST_PASSWORD;
const confirmProject = process.argv.find((value) => value.startsWith("--confirm-project="))?.split("=", 2)[1];
if (!projectId || projectId === "optimize-local" || !projectId.includes("staging") || confirmProject !== projectId) throw new Error("Rules verification requires an explicitly confirmed staging project.");
if (!apiKey || !password) throw new Error("Staging browser API key and test password are required.");

async function signIn(email: string) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey!)}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await response.json() as { idToken?: string; error?: { message?: string } };
  if (!response.ok || !body.idToken) throw new Error(`Staging sign-in failed: ${body.error?.message ?? response.status}`);
  return body.idToken;
}
const pmToken = await signIn("pm-owner@staging.optimizelocal.example");
const preferredToken = await signIn("preferred-owner@staging.optimizelocal.example");
const networkToken = await signIn("network-owner@staging.optimizelocal.example");
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const request = (path: string, token?: string, init?: RequestInit) => fetch(`${firestoreBase}/${path}`, { ...init, headers: { ...(init?.headers ?? {}), ...(token ? { authorization: `Bearer ${token}` } : {}) } });
async function expectStatus(label: string, expected: number, response: Promise<Response>) {
  const result = await response;
  assert.equal(result.status, expected, `${label}: expected ${expected}, received ${result.status}`);
  return { label, status: result.status };
}

const db = getMigrationFirestore();
const member = (id: string, organizationId: string, organizationName: string, organizationType: "property_management" | "vendor") => ({ id, organizationId, organizationName, organizationType, role: "owner" as const });
const admin: AppUser = { id: "staging-super-admin", email: "super-admin@staging.optimizelocal.example", fullName: "Staging Super Admin", avatarUrl: null, isSuperAdmin: true, memberships: [] };
const pm: AppUser = { id: "staging-pm-owner", email: "pm-owner@staging.optimizelocal.example", fullName: "Rockford PM Demo Owner", avatarUrl: null, isSuperAdmin: false, memberships: [member("pm", "staging-pm-rockford", "Rockford Property Management Demo", "property_management")] };
const requestId = await submitFirebaseServiceRequest({ user: pm, organizationId: "staging-pm-rockford", propertyId: "staging-property-riverside", categorySlug: "plumbing-sewer", categoryName: "Plumbing / Sewer", problemDescription: "Rules boundary rehearsal request", priority: "flexible", contactPreference: "email", contactName: "Private Boundary Contact", contactEmail: "private-boundary@staging.optimizelocal.example" }, db);
await markFirebaseServiceRequestReviewing({ user: admin, requestId }, db);
const assignmentId = await assignFirebaseServiceRequest({ user: admin, requestId, vendorOrganizationId: "staging-vendor-network" }, db);

const results = [];
results.push(await expectStatus("pm_own_property", 200, request("properties/staging-property-main", pmToken)));
results.push(await expectStatus("pm_cross_org_property_denied", 403, request("properties/staging-property-other", pmToken)));
results.push(await expectStatus("assigned_vendor_safe_request", 200, request(`serviceRequests/${requestId}`, networkToken)));
results.push(await expectStatus("assigned_vendor_private_before_accept_denied", 403, request(`serviceRequestPrivate/${requestId}`, networkToken)));
results.push(await expectStatus("other_vendor_assignment_denied", 403, request(`serviceRequestAssignments/${assignmentId}`, preferredToken)));
results.push(await expectStatus("anonymous_private_profile_denied", 403, request("vendorProfiles/staging-vendor-network")));
results.push(await expectStatus("anonymous_public_projection", 200, request("publicMarketplaceVendors/staging-vendor-network")));
const writeBody = JSON.stringify({ fields: { status: { stringValue: "active" } } });
const writeInit = { method: "PATCH", headers: { "content-type": "application/json" }, body: writeBody };
results.push(await expectStatus("client_membership_write_denied", 403, request("memberships/client-forgery", networkToken, writeInit)));
results.push(await expectStatus("client_platform_admin_write_denied", 403, request("platformAdmins/staging-network-owner", networkToken, writeInit)));
results.push(await expectStatus("client_publication_forgery_denied", 403, request("publicMarketplaceVendors/staging-vendor-network", networkToken, writeInit)));

process.stdout.write(`${JSON.stringify({ projectId, requestId, assignmentId, results, storageRules: "BLOCKED_BY_FIREBASE_BILLING_REQUIREMENT" }, null, 2)}\n`);
