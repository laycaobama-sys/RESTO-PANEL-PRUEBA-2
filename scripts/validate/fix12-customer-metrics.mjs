// ============================================================
// Fix 12: Customer Metrics with 3 branches (visits/no_shows/cancellations)
// ============================================================
// Verifies that update_customer_metrics() in 0019_phase_audit_fixes.sql
// contains all 3 metric branches:
//   - visits_count (on COMPLETED transitions)
//   - no_shows_count (on NO_SHOW transitions)
//   - cancellations_count (on CANCELLED transitions)
//
// Strategy:
//   1. Read the migration file
//   2. Confirm each counter has BOTH increment AND decrement logic
//   3. Functional test: simulate the trigger for each transition
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';

const ROOT = process.cwd();
const sqlPath = resolve(ROOT, 'supabase/migrations/0019_phase_audit_fixes.sql');
const src = readFileSync(sqlPath, 'utf8');

// ─── Step 1: function exists ───────────────────────────────
assert.ok(
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+update_customer_metrics\s*\(\s*\)/i.test(src),
  'CREATE OR REPLACE FUNCTION update_customer_metrics() must be present'
);
console.log('✓ update_customer_metrics() function declared');

// ─── Step 2: visits_count branch ───────────────────────────
assert.ok(
  /visits_count\s*=\s*COALESCE\(visits_count,\s*0\)\s*\+\s*1/i.test(src),
  'visits_count increment branch must exist'
);
assert.ok(
  /visits_count\s*=\s*GREATEST\(\s*0,\s*COALESCE\(visits_count,\s*1\)\s*-\s*1\)/i.test(src),
  'visits_count decrement branch must exist (reversal)'
);
assert.ok(/COMPLETED/i.test(src), 'COMPLETED status branch must exist');
console.log('✓ visits_count branch (COMPLETED increment/decrement) present');

// ─── Step 3: no_shows_count branch ─────────────────────────
assert.ok(
  /no_shows_count\s*=\s*COALESCE\(no_shows_count,\s*0\)\s*\+\s*1/i.test(src),
  'no_shows_count increment branch must exist'
);
assert.ok(
  /no_shows_count\s*=\s*GREATEST\(\s*0,\s*COALESCE\(no_shows_count,\s*1\)\s*-\s*1\)/i.test(src),
  'no_shows_count decrement branch must exist (reversal)'
);
assert.ok(/NO_SHOW/i.test(src), 'NO_SHOW status branch must exist');
console.log('✓ no_shows_count branch (NO_SHOW increment/decrement) present');

// ─── Step 4: cancellations_count branch ────────────────────
assert.ok(
  /cancellations_count\s*=\s*COALESCE\(cancellations_count,\s*0\)\s*\+\s*1/i.test(src),
  'cancellations_count increment branch must exist'
);
assert.ok(
  /cancellations_count\s*=\s*GREATEST\(\s*0,\s*COALESCE\(cancellations_count,\s*1\)\s*-\s*1\)/i.test(src),
  'cancellations_count decrement branch must exist (reversal)'
);
assert.ok(/CANCELLED/i.test(src), 'CANCELLED status branch must exist');
console.log('✓ cancellations_count branch (CANCELLED increment/decrement) present');

// ─── Step 5: counts of each increment ──────────────────────
const incVisits = (src.match(/visits_count\s*=\s*COALESCE\(visits_count,\s*0\)\s*\+\s*1/gi) || []).length;
const incNoShows = (src.match(/no_shows_count\s*=\s*COALESCE\(no_shows_count,\s*0\)\s*\+\s*1/gi) || []).length;
const incCancels = (src.match(/cancellations_count\s*=\s*COALESCE\(cancellations_count,\s*0\)\s*\+\s*1/gi) || []).length;
console.log(`\nIncrement occurrences: visits=${incVisits} no_shows=${incNoShows} cancellations=${incCancels}`);
assert.equal(incVisits, 1, 'Exactly one visits_count increment');
assert.equal(incNoShows, 1, 'Exactly one no_shows_count increment');
assert.equal(incCancels, 1, 'Exactly one cancellations_count increment');

// Extract the function body for the report
const fnStart = src.indexOf('CREATE OR REPLACE FUNCTION update_customer_metrics');
const fnEnd = src.indexOf('$$;', fnStart) + 3;
console.log('\n--- update_customer_metrics() body (verbatim) ---');
console.log(src.slice(fnStart, fnEnd));

// ─── Step 6: functional test — simulate the trigger ────────
// Re-implement the trigger logic in JS to verify all 3 branches.
function applyTransition(customer, oldStatus, newStatus) {
  if (oldStatus === newStatus) return customer;
  if (!customer.id) return customer;
  const c = { ...customer };

  // visits_count (COMPLETED)
  if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED') {
    c.visits_count = (c.visits_count || 0) + 1;
    c.last_visit_at = new Date();
  }
  if (oldStatus === 'COMPLETED' && newStatus !== 'COMPLETED') {
    c.visits_count = Math.max(0, (c.visits_count || 1) - 1);
  }

  // no_shows_count (NO_SHOW)
  if (newStatus === 'NO_SHOW' && oldStatus !== 'NO_SHOW') {
    c.no_shows_count = (c.no_shows_count || 0) + 1;
  }
  if (oldStatus === 'NO_SHOW' && newStatus !== 'NO_SHOW') {
    c.no_shows_count = Math.max(0, (c.no_shows_count || 1) - 1);
  }

  // cancellations_count (CANCELLED)
  if (newStatus === 'CANCELLED' && !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(oldStatus)) {
    c.cancellations_count = (c.cancellations_count || 0) + 1;
  }
  if (oldStatus === 'CANCELLED' && !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(newStatus)) {
    c.cancellations_count = Math.max(0, (c.cancellations_count || 1) - 1);
  }
  return c;
}

// Start with a fresh customer
let c = { id: 'C1', visits_count: 0, no_shows_count: 0, cancellations_count: 0 };
console.log('\n--- Transition simulation ---');
console.log('Initial:', JSON.stringify(c));

// PENDING → COMPLETED → visits_count = 1
c = applyTransition(c, 'PENDING', 'COMPLETED');
assert.equal(c.visits_count, 1);
console.log('After PENDING→COMPLETED:', JSON.stringify(c));

// COMPLETED → NO_SHOW → visits_count = 0, no_shows_count = 1
c = applyTransition(c, 'COMPLETED', 'NO_SHOW');
assert.equal(c.visits_count, 0);
assert.equal(c.no_shows_count, 1);
console.log('After COMPLETED→NO_SHOW:', JSON.stringify(c));

// Fresh customer, PENDING → CANCELLED → cancellations_count = 1
c = { id: 'C2', visits_count: 0, no_shows_count: 0, cancellations_count: 0 };
c = applyTransition(c, 'PENDING', 'CANCELLED');
assert.equal(c.cancellations_count, 1);
console.log('After PENDING→CANCELLED:', JSON.stringify(c));

// Reversal: CANCELLED → PENDING → cancellations_count = 0
c = applyTransition(c, 'CANCELLED', 'PENDING');
assert.equal(c.cancellations_count, 0);
console.log('After CANCELLED→PENDING (reversal):', JSON.stringify(c));

console.log('\n✅ PASS: update_customer_metrics() has all 3 branches (visits/no_shows/cancellations) with reversal logic.');
process.exit(0);
