import test from "node:test";
import assert from "node:assert/strict";
import { getRoleHome, isVendorEnrollmentPath, safeInternalPath } from "../src/lib/auth/routing";
import type { AppUser, Membership } from "../src/domain/auth/types";

const membership = (overrides: Partial<Membership> = {}): Membership => ({
  id: "membership-1",
  organizationId: "organization-1",
  organizationName: "Test Organization",
  organizationType: "property_management",
  role: "property_manager",
  ...overrides,
});

const user = (overrides: Partial<AppUser> = {}): AppUser => ({
  id: "user-1",
  email: "person@example.com",
  fullName: null,
  avatarUrl: null,
  isSuperAdmin: false,
  memberships: [membership()],
  ...overrides,
});

test("safeInternalPath blocks external redirect forms", () => {
  assert.equal(safeInternalPath("/requests?open=1"), "/requests?open=1");
  assert.equal(safeInternalPath("//attacker.example"), "/dashboard");
  assert.equal(safeInternalPath("/\\attacker.example"), "/dashboard");
  assert.equal(safeInternalPath("https://attacker.example"), "/dashboard");
});

test("only recognized membership onboarding paths may create a vendor auth user", () => {
  assert.equal(isVendorEnrollmentPath("/onboarding?plan=founding_vendor"), true);
  assert.equal(isVendorEnrollmentPath("/onboarding?plan=network_member"), true);
  assert.equal(isVendorEnrollmentPath("/onboarding?plan=unknown"), false);
  assert.equal(isVendorEnrollmentPath("/admin"), false);
});

test("role homes separate platform, property, and vendor operations", () => {
  assert.equal(getRoleHome(user({ isSuperAdmin: true, memberships: [] })), "/admin");
  assert.equal(getRoleHome(user()), "/manager");
  assert.equal(getRoleHome(user({ memberships: [membership({ role: "owner" })] })), "/admin");
  assert.equal(getRoleHome(user({ memberships: [membership({ role: "technician", organizationType: "vendor" })] })), "/vendor");
  assert.equal(getRoleHome(user({ memberships: [] })), "/onboarding");
});
