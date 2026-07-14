import test from "node:test";
import assert from "node:assert/strict";
import { getVertical, PROPERTY_MANAGEMENT_VERTICAL, SHARED_PLATFORM_MODULES, VERTICAL_REGISTRY } from "../src/domain/verticals/registry";

test("property management is the launch vertical", () => {
  assert.equal(PROPERTY_MANAGEMENT_VERTICAL.status, "launch");
  assert.equal(PROPERTY_MANAGEMENT_VERTICAL.version, 1);
  assert.equal(getVertical("property_management"), PROPERTY_MANAGEMENT_VERTICAL);
});

test("future community marketplaces reuse the shared platform core", () => {
  const verticals = Object.values(VERTICAL_REGISTRY);
  assert.equal(verticals.length, 9);
  assert.equal(verticals.filter((vertical) => vertical.status === "launch").length, 1);
  for (const vertical of verticals) {
    for (const moduleKey of SHARED_PLATFORM_MODULES) assert.ok(vertical.capabilities.includes(moduleKey));
    if (vertical.key !== "property_management") {
      assert.equal(vertical.status, "planned");
      assert.equal(vertical.version, null);
      assert.deepEqual(vertical.navigation, []);
    }
  }
  assert.ok(SHARED_PLATFORM_MODULES.includes("impact_engine"));
});

test("vertical keys and capability namespaces are unique", () => {
  const verticals = Object.values(VERTICAL_REGISTRY);
  assert.equal(new Set(verticals.map((vertical) => vertical.key)).size, verticals.length);
  for (const vertical of verticals) {
    assert.equal(new Set(vertical.capabilities).size, vertical.capabilities.length);
  }
});
