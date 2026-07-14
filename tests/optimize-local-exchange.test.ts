import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FUTURE_SHARED_PLATFORM_MODULES } from "../src/domain/verticals/registry";

const migration=readFileSync(new URL("../supabase/migrations/202607140011_optimize_local_exchange.sql",import.meta.url),"utf8");

test("Optimize Local Exchange is planned for Version 3 without UI exposure",()=>{
  assert.deepEqual(FUTURE_SHARED_PLATFORM_MODULES,[{key:"optimize_local_exchange",name:"Optimize Local Exchange",targetVersion:3,status:"planned",uiExposed:false}]);
  assert.match(migration,/"target_version":3,"ui_exposed":false/);
  assert.match(migration,/select id,'optimize_local_exchange',false/);
});

test("Exchange models opt-in, needs, offers, requests, proposals, history, and ratings",()=>{
  for(const table of ["exchange_business_profiles","exchange_business_needs","exchange_business_offers","exchange_trade_requests","exchange_trade_proposals","exchange_trades","exchange_trade_deliverables","exchange_trade_ratings"]){
    assert.match(migration,new RegExp(`create table public\\.${table}`));
  }
  assert.match(migration,/open_to_trade boolean not null default false/);
  assert.match(migration,/unique\(exchange_trade_id,rater_organization_id\)/);
});

test("Exchange AI matching is provider-neutral and explainable",()=>{
  assert.match(migration,/ai_optimization_run_id uuid references public\.ai_optimization_runs/);
  assert.match(migration,/policy_key text not null default 'exchange_capacity_match'/);
  assert.match(migration,/contributions jsonb not null/);
  assert.doesNotMatch(migration,/openai|anthropic|gemini/i);
});

test("future trade credits are disabled and use balanced service-only posting",()=>{
  assert.match(migration,/'planned','\{"transferable":false,"cash_equivalent":false,"ui_exposed":false/);
  assert.match(migration,/if coalesce\(auth\.jwt\(\)->>'role',''\)<>'service_role'/);
  assert.match(migration,/if debit_total=0 or debit_total<>credit_total/);
  assert.match(migration,/trade credits are not active/);
  assert.match(migration,/insufficient trade credits/);
});

test("Exchange data is tenant-scoped with RLS and protected party keys",()=>{
  assert.match(migration,/alter table public\.%I enable row level security/);
  assert.match(migration,/exchange_requests_read_parties/);
  assert.match(migration,/exchange_trade_requests_protect_keys/);
  assert.match(migration,/exchange_trades_protect_keys/);
  assert.match(migration,/exchange_proposals_validate_party/);
  assert.match(migration,/exchange_trades_validate_parties/);
  assert.match(migration,/exchange_ratings_validate_parties/);
});
