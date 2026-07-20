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

test("homepage positions the Rockford Founding Vendor network accurately", () => {
  const homePage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(homePage, /Founding Vendor Enrollment Now Open/);
  assert.match(homePage, /Become a Founding Vendor/);
  assert.match(homePage, /more than 9,000 rental doors/);
  assert.match(homePage, /ArrowLink href="\/founders">Become a Founding Vendor — \{founderPrice\}/);
  assert.match(homePage, /Founding Vendors receive premium placement/);
  assert.match(homePage, /renews annually until canceled/);
  assert.match(homePage, /broader rental-property network/);
  assert.doesNotMatch(homePage, /400 property managers (?:are|currently) (?:active|using)/i);
});
