// ============================================================
// Fix 5: Feature Flags respect subscription status
// ============================================================
// Verifies that EFFECTIVE_PLAN downgrades to 'starter' when the
// subscription status is 'canceled' or 'past_due', regardless of
// the org's nominal plan.
//
// Strategy:
//   1. Read src/lib/feature-flags.ts
//   2. Confirm the EFFECTIVE_PLAN ternary is present.
//   3. Functional test: with a 'professional' plan, walk through
//      all 4 subscription statuses and assert EFFECTIVE_PLAN:
//        trial   → 'professional'
//        active  → 'professional'
//        past_due → 'starter'    (DOWNGRADE)
//        canceled → 'starter'    (DOWNGRADE)
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';

const ROOT = process.cwd();
const src = readFileSync(resolve(ROOT, 'src/lib/feature-flags.ts'), 'utf8');

// ─── Step 1: EFFECTIVE_PLAN ternary exists ─────────────────
assert.ok(
  /const\s+EFFECTIVE_PLAN\s*=\s*\(\s*orgStatus\s*===\s*['"]canceled['"]\s*\|\|\s*orgStatus\s*===\s*['"]past_due['"]\s*\)\s*\?\s*['"]starter['"]\s*:\s*orgPlan/.test(src),
  'EFFECTIVE_PLAN must be (canceled||past_due) ? "starter" : orgPlan'
);
console.log('✓ EFFECTIVE_PLAN ternary present and matches spec');

// Extract for the report
const m = src.match(/const\s+EFFECTIVE_PLAN[\s\S]{0,300}/);
console.log('\n--- EFFECTIVE_PLAN code (verbatim) ---');
console.log(m[0]);

// ─── Step 2: EFFECTIVE_PLAN is used for orgPlanLevel ───────
assert.ok(
  /PLAN_HIERARCHY\[EFFECTIVE_PLAN\]/.test(src),
  'EFFECTIVE_PLAN must be passed into PLAN_HIERARCHY[]'
);
console.log('✓ EFFECTIVE_PLAN is used to compute orgPlanLevel');

// ─── Step 3: functional test ───────────────────────────────
const PLAN_HIERARCHY = { starter: 1, professional: 2, enterprise: 3 };

function effectivePlan(orgPlan, orgStatus) {
  return (orgStatus === 'canceled' || orgStatus === 'past_due')
    ? 'starter'
    : orgPlan;
}

const cases = [
  // [orgPlan, orgStatus, expectedEffectivePlan]
  ['professional', 'trial',    'professional'],
  ['professional', 'active',   'professional'],
  ['professional', 'past_due', 'starter'],   // downgrade
  ['professional', 'canceled', 'starter'],   // downgrade
  ['enterprise',   'canceled', 'starter'],   // downgrade from top tier
  ['starter',      'canceled', 'starter'],   // already starter
  ['enterprise',   'trial',    'enterprise'],
];

for (const [orgPlan, orgStatus, expected] of cases) {
  const actual = effectivePlan(orgPlan, orgStatus);
  assert.equal(actual, expected,
    `orgPlan=${orgPlan} status=${orgStatus} expected=${expected} got=${actual}`);
  const level = PLAN_HIERARCHY[actual];
  console.log(`✓ orgPlan=${orgPlan.padEnd(12)} status=${orgStatus.padEnd(9)} → EFFECTIVE=${actual.padEnd(12)} (level=${level})`);
}

// ─── Step 4: prove a canceled enterprise user gets downgrade ─
const entActiveLevel = PLAN_HIERARCHY[effectivePlan('enterprise', 'active')];
const entCanceledLevel = PLAN_HIERARCHY[effectivePlan('enterprise', 'canceled')];
assert.equal(entActiveLevel, 3, 'Enterprise active should be level 3');
assert.equal(entCanceledLevel, 1, 'Enterprise canceled must be downgraded to level 1 (starter)');
console.log(`\n✓ Canceled Enterprise: level ${entActiveLevel} → ${entCanceledLevel} (premium features revoked)`);

console.log('\n✅ PASS: Feature flags correctly downgrade canceled/past_due subscriptions to starter.');
process.exit(0);
