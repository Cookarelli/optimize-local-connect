import assert from "node:assert/strict";
import test from "node:test";
import { hasPermission, PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "../src/domain/auth/roles";

test("every role has an explicit permission set", () => {
  assert.deepEqual(Object.keys(ROLE_PERMISSIONS).sort(), [...ROLES].sort());
});

test("super admin has every registered permission", () => {
  for (const permission of PERMISSIONS) {
    assert.equal(hasPermission("super_admin", permission), true, permission);
  }
});

test("privileged operations remain narrowly scoped", () => {
  assert.equal(hasPermission("owner", "billing:manage"), true);
  assert.equal(hasPermission("admin", "billing:manage"), false);
  assert.equal(hasPermission("property_manager", "properties:delete"), false);
  assert.equal(hasPermission("vendor", "quotes:create"), true);
  assert.equal(hasPermission("technician", "quotes:create"), false);
  assert.equal(hasPermission("future_resident", "properties:view"), false);
});
