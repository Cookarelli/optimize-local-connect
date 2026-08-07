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

test("public messaging reflects the launch network and relationship-driven positioning", () => {
  const homePage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const companyPage = readFileSync(new URL("../app/company/page.tsx", import.meta.url), "utf8");
  const membershipsPage = readFileSync(new URL("../app/memberships/page.tsx", import.meta.url), "utf8");
  const demoPage = readFileSync(new URL("../app/demo/vendor-dashboard/page.tsx", import.meta.url), "utf8");
  const publicSource = [homePage, companyPage, membershipsPage, demoPage].join("\n");
  assert.match(homePage, /Founding Member Enrollment Now Open/);
  assert.match(homePage, /Dependable local vendors/);
  assert.match(homePage, /A growing network serving more than 100 local homes—and counting/);
  assert.match(companyPage, /inspired by a request from property-management leader Mary O’Sullivan/);
  assert.match(companyPage, /repeatedly searching Google for a new contractor/);
  assert.match(membershipsPage, /FoundingMemberAvailability/);
  assert.match(membershipsPage, /Five positions initially available per service category/);
  assert.match(membershipsPage, /Ten positions initially available per service category/);
  assert.doesNotMatch(publicSource, /9,?000\s*(?:rental\s*)?(?:apartments|doors|rentals|units)/i);
  assert.doesNotMatch(publicSource, /18,?000\s*(?:rental\s*)?(?:apartments|doors|rentals|units)/i);
  assert.doesNotMatch(publicSource, /guaranteed (?:NILA|Northern Illinois Landlord Association) adoption/i);
  assert.doesNotMatch(publicSource, /all (?:NILA|Northern Illinois Landlord Association) members (?:use|are on)/i);
  assert.match(homePage, /FOUNDING_MEMBER_OFFER\.cta/);
  assert.match(homePage, /Founding Members receive premium placement/);
  assert.match(homePage, /FOUNDING_MEMBER_OFFER\.monthlyComparison/);
  assert.match(homePage, /one good job can pay for the entire year/);
  assert.match(membershipsPage, /FoundingMemberAvailability/);
  assert.match(membershipsPage, /not just another directory listing/);
  assert.match(membershipsPage, /leads, jobs, and revenue are never guaranteed/);
  assert.match(membershipsPage, /\$49\/month/);
  assert.match(membershipsPage, /\$19\/month/);
});
