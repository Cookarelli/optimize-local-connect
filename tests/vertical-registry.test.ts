import test from "node:test";
import assert from "node:assert/strict";
import { getVertical, PROPERTY_MANAGEMENT_VERTICAL, VERTICAL_REGISTRY } from "../src/domain/verticals/registry";

test("property management is the launch vertical", () => {
  assert.equal(PROPERTY_MANAGEMENT_VERTICAL.status, "launch");
  assert.equal(getVertical("property_management"), PROPERTY_MANAGEMENT_VERTICAL);
});

test("vertical keys and capability namespaces are unique", () => {
  const verticals = Object.values(VERTICAL_REGISTRY);
  assert.equal(new Set(verticals.map((vertical) => vertical.key)).size, verticals.length);
  for (const vertical of verticals) {
    assert.equal(new Set(vertical.capabilities).size, vertical.capabilities.length);
  }
});
