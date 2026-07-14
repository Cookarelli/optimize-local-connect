import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateEstimatedHoursSaved, calculateEstimatedSavings, EMPTY_IMPACT_SUMMARY, IMPACT_METRICS, parseImpactSummary } from "../src/domain/impact/metrics";
import { getImpactRange } from "../src/lib/impact/summary";

const migration=readFileSync(new URL("../supabase/migrations/202607140009_impact_engine.sql",import.meta.url),"utf8");

test("Impact Engine exposes every required governed metric",()=>{
  assert.deepEqual(IMPACT_METRICS.map(metric=>metric.key),["estimated_money_saved","estimated_hours_saved","average_savings_per_work_order","vendor_response_time","emergency_response_time","community_savings_since_launch","jobs_completed","vendor_growth","local_spending_retained","portfolio_savings"]);
  assert.equal(new Set(IMPACT_METRICS.map(metric=>metric.key)).size,10);
});

test("estimated savings never reports negative impact",()=>{
  assert.equal(calculateEstimatedSavings(100_000,72_500),27_500);
  assert.equal(calculateEstimatedSavings(50_000,72_500),0);
  assert.throws(()=>calculateEstimatedSavings(-1,10));
  assert.equal(calculateEstimatedHoursSaved(8,2.5),5.5);
  assert.equal(calculateEstimatedHoursSaved(2,8),0);
});

test("database records immutable, idempotent, versioned observations",()=>{
  assert.match(migration,/impact_observations_immutable/);
  assert.match(migration,/idempotency_key text not null unique/);
  assert.match(migration,/foreign key \(methodology_key,methodology_version\)/);
  assert.match(migration,/on conflict \(idempotency_key\) do nothing/g);
});

test("work order and vendor lifecycle events feed automatic impact capture",()=>{
  assert.match(migration,/capture_completed_work_order_impact/);
  assert.match(migration,/capture_vendor_growth_impact/);
  assert.match(migration,/vendor_response_time/);
  assert.match(migration,/emergency_response_time/);
});

test("impact summaries parse numeric database strings and handle missing data",()=>{
  assert.deepEqual(parseImpactSummary(null),EMPTY_IMPACT_SUMMARY);
  const parsed=parseImpactSummary({estimated_money_saved_cents:"15000",estimated_hours_saved:"4.5",average_savings_per_work_order_cents:"7500",vendor_response_minutes:"12.5",emergency_response_minutes:null,community_savings_since_launch_cents:"60000",jobs_completed:"2",vendor_growth:"1",local_spending_retained_cents:"12000"});
  assert.equal(parsed.estimated_money_saved_cents,15000);
  assert.equal(parsed.vendor_response_minutes,12.5);
});

test("reporting ranges are bounded and deterministic",()=>{
  const days=(range:{startDate:string;endDate:string})=>(Date.parse(range.endDate)-Date.parse(range.startDate))/86_400_000+1;
  assert.equal(days(getImpactRange("30d")),30);
  assert.equal(days(getImpactRange("365d")),365);
});

test("future AI reporting stores governed snapshots without naming a provider",()=>{
  assert.match(migration,/create table public\.impact_snapshots/);
  assert.match(migration,/create table public\.impact_report_requests/);
  assert.match(migration,/provider_connection_id uuid references public\.ai_provider_connections/);
  assert.doesNotMatch(migration,/openai|anthropic|gemini|claude/i);
});

test("tenant summaries and platform reports enforce separate authorization",()=>{
  assert.match(migration,/get_organization_impact_summary[\s\S]*is_organization_member/);
  assert.match(migration,/get_platform_impact_summary[\s\S]*super admin required/);
  assert.match(migration,/alter table public\.impact_observations enable row level security/);
});
