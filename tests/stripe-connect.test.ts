import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const connect = readFileSync("src/lib/stripe/connect.ts", "utf8");
const migration = readFileSync("supabase/migrations/202607180019_stripe_connect_marketplace.sql", "utf8");
const snapshotWebhook = readFileSync("app/api/payments/stripe/marketplace-webhook/route.ts", "utf8");
const thinWebhook = readFileSync("app/api/payments/stripe/connect-events/route.ts", "utf8");

test("Connect V2 creates recipient accounts without a legacy top-level type", () => {
  assert.match(connect, /v2\.core\.accounts\.create/);
  assert.match(connect, /dashboard: "express"/);
  assert.match(connect, /fees_collector: "application"/);
  assert.match(connect, /losses_collector: "application"/);
  assert.match(connect, /stripe_transfers: \{ requested: true \}/);
  assert.doesNotMatch(connect, /type:\s*["'](?:express|standard|custom)["']/);
});

test("account readiness is fetched from Stripe instead of persisted", () => {
  assert.match(connect, /v2\.core\.accounts\.retrieve/);
  assert.match(connect, /include: \["configuration\.recipient", "requirements"\]/);
  assert.doesNotMatch(migration, /onboarding_complete|requirements_status|transfer_status/);
});

test("destination checkout uses an explicit configured application fee", () => {
  assert.match(connect, /STRIPE_CONNECT_APPLICATION_FEE_BPS/);
  assert.match(connect, /300 basis points = a 3\.00% platform fee/);
  assert.match(connect, /applicationFeeCents > 0[\s\S]*application_fee_amount: input\.applicationFeeCents/);
  assert.match(connect, /transfer_data: \{ destination: input\.destinationAccountId \}/);
  assert.match(connect, /purchase_type: "marketplace_product"/);
});

test("marketplace order and event identifiers are duplicate-safe", () => {
  assert.match(migration, /stripe_checkout_session_id text not null unique/);
  assert.match(migration, /stripe_payment_intent_id text unique/);
  assert.match(migration, /stripe_event_id text not null unique/);
  assert.match(snapshotWebhook, /prior\?\.processed_at/);
  assert.match(thinWebhook, /prior\?\.processed_at/);
});

test("snapshot and V2 thin webhook signatures are verified by the Stripe client", () => {
  assert.match(snapshotWebhook, /constructEventAsync/);
  assert.match(thinWebhook, /parseEventNotificationAsync/);
  assert.match(thinWebhook, /v2\.core\.account\[requirements\]\.updated/);
  assert.match(thinWebhook, /v2\.core\.account\[configuration\.recipient\]\.capability_status_updated/);
  assert.match(snapshotWebhook, /Marketplace webhook is not configured[\s\S]*status: 500/);
  assert.match(thinWebhook, /Connect events webhook is not configured[\s\S]*status: 500/);
});
