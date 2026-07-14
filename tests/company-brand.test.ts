import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("founder story preserves the 2008 local-economy lesson and manifesto", () => {
  const companyPage = readFileSync(new URL("../app/company/page.tsx", import.meta.url), "utf8");
  assert.match(companyPage, /During the 2008 recession/);
  assert.match(companyPage, /keep more dollars circulating nearby/);
  assert.match(companyPage, /We’re not building software/);
  assert.match(companyPage, /one optimized decision at a time/);
});

test("investor hero positions the platform and Property Management launch", () => {
  const homePage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(homePage, /AI-powered technology helping communities/);
  assert.match(homePage, /save time, save money, and strengthen local economies/);
  assert.match(homePage, /Connecting trusted local businesses with property managers and communities through intelligent technology/);
  assert.match(homePage, /Property Management/);
  assert.match(homePage, /First Industry Launch/);
  assert.match(homePage, /Future community marketplaces/);
});
