import test from "node:test";
import assert from "node:assert/strict";
import { COMPANY_VALUES, PLATFORM_BRAND } from "../src/domain/platform/brand";

test("company philosophy centers local economic impact", () => {
  assert.match(PLATFORM_BRAND.philosophy, /AI-powered technology/);
  assert.match(PLATFORM_BRAND.philosophy, /keep more money local/);
  assert.match(PLATFORM_BRAND.philosophy, /measurable economic impact/);
});

test("company values are distinct and actionable", () => {
  assert.equal(COMPANY_VALUES.length, 5);
  assert.equal(new Set(COMPANY_VALUES.map((value) => value.name)).size, COMPANY_VALUES.length);
  assert.ok(COMPANY_VALUES.every((value) => value.statement.length > 40));
});
