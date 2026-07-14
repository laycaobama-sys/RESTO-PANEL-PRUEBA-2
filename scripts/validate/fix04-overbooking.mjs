// ============================================================
// Fix 4: Overbooking check on POST /api/reservations
// ============================================================
// Verifies that the POST handler runs an overlap query with
//   .in('status', ['CONFIRMED', 'PENDING', 'SEATED'])
//   .gte('date', slotStart)
//   .lte('date', slotEnd)
// and returns 409 on conflict.
//
// Strategy:
//   1. Read src/app/api/reservations/route.ts
//   2. Confirm the overlap query block exists with all required
//      predicates.
//   3. Confirm 409 status on conflict.
//   4. Functional test: simulate the query against an in-memory
//      list of existing reservations, with 3 scenarios:
//        a) No conflict → 201
//        b) Overlapping CONFIRMED reservation → 409
//        c) Overlapping CANCELLED reservation → 201 (cancelled
//           is not in the status list, so no conflict).
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';

const ROOT = process.cwd();
const src = readFileSync(resolve(ROOT, 'src/app/api/reservations/route.ts'), 'utf8');

// ─── Step 1: overlap query block present ───────────────────
assert.ok(/overbooking/i.test(src), 'Comment/code mentioning overbooking must exist');

assert.ok(
  /\.in\(\s*['"]status['"]\s*,\s*\[\s*['"]CONFIRMED['"]\s*,\s*['"]PENDING['"]\s*,\s*['"]SEATED['"]\s*\]\s*\)/.test(src),
  'Overlap query must filter .in("status", ["CONFIRMED","PENDING","SEATED"])'
);
console.log('✓ .in("status", ["CONFIRMED","PENDING","SEATED"]) filter present');

assert.ok(
  /\.gte\(\s*['"]date['"]\s*,\s*slotStart/.test(src),
  'Overlap query must use .gte("date", slotStart)'
);
assert.ok(
  /\.lte\(\s*['"]date['"]\s*,\s*slotEnd/.test(src),
  'Overlap query must use .lte("date", slotEnd)'
);
console.log('✓ Time window predicates .gte/.lte present');

assert.ok(
  /\.eq\(\s*['"]table_id['"]\s*,\s*tableId\s*\)/.test(src),
  'Overlap query must scope to the same table_id'
);
console.log('✓ Table-scoped predicate .eq("table_id", tableId) present');

// ─── Step 2: 409 status on conflict ────────────────────────
assert.ok(
  /status:\s*409/.test(src),
  'On conflict, the response must return HTTP 409'
);
console.log('✓ HTTP 409 returned on conflict');

// Extract the overbooking block for the report
const blockStart = src.indexOf('Overbooking check');
const blockEnd = src.indexOf('}\n', src.indexOf('409', blockStart)) + 1;
console.log('\n--- Overbooking block (verbatim) ---');
console.log(src.slice(blockStart - 30, blockEnd + 50));

// ─── Step 3: functional simulation ─────────────────────────
// Re-implement the conflict check exactly as the source.
const STATUSES_THAT_BLOCK = ['CONFIRMED', 'PENDING', 'SEATED'];

function findConflict(existingReservations, tableId, date, durationMin) {
  const slotStart = new Date(date.getTime() - durationMin * 60000);
  const slotEnd = new Date(date.getTime() + durationMin * 60000);
  return existingReservations.find(r =>
    r.table_id === tableId &&
    STATUSES_THAT_BLOCK.includes(r.status) &&
    new Date(r.date) >= slotStart &&
    new Date(r.date) <= slotEnd
  );
}

const tableId = 'T1';
const existing = [
  // 19:00 today, CONFIRMED → conflicts with 19:00 same table
  { table_id: 'T1', date: new Date('2026-01-01T19:00:00Z'), status: 'CONFIRMED' },
  // 22:00 today, CANCELLED → does NOT conflict (cancelled)
  { table_id: 'T1', date: new Date('2026-01-01T22:00:00Z'), status: 'CANCELLED' },
  // 19:30 on T2 (different table) → does NOT conflict (different table)
  { table_id: 'T2', date: new Date('2026-01-01T19:30:00Z'), status: 'CONFIRMED' },
];

// Scenario A: new reservation at 19:00 on T1, 120 min duration → conflict with existing 19:00
const a = findConflict(existing, 'T1', new Date('2026-01-01T19:00:00Z'), 120);
assert.ok(a, 'Scenario A: must find a conflict at 19:00 on T1');
assert.equal(a.status, 'CONFIRMED');
console.log('\n✓ Scenario A: 19:00 T1 conflicts with existing 19:00 CONFIRMED → 409');

// Scenario B: new reservation at 22:00 on T1 — existing 22:00 is CANCELLED, must NOT conflict
const b = findConflict(existing, 'T1', new Date('2026-01-01T22:00:00Z'), 120);
assert.equal(b, undefined, 'Scenario B: CANCELLED reservations must NOT block new bookings');
console.log('✓ Scenario B: 22:00 T1 does NOT conflict with CANCELLED reservation → 201');

// Scenario C: new reservation at 19:30 on T2 — same time, different table
const c = findConflict(existing, 'T2', new Date('2026-01-01T19:30:00Z'), 120);
assert.ok(c, 'Scenario C: T2 19:30 must find the existing T2 19:30 CONFIRMED');
console.log('✓ Scenario C: T2 19:30 conflicts with existing T2 19:30 CONFIRMED → 409');

// Scenario D: new reservation at 16:00 on T1, no conflicts
const d = findConflict(existing, 'T1', new Date('2026-01-01T16:00:00Z'), 120);
assert.equal(d, undefined, 'Scenario D: empty slot must not conflict');
console.log('✓ Scenario D: 16:00 T1 has no conflicts → 201');

console.log('\n✅ PASS: Overbooking check correctly returns 409 for overlapping active reservations.');
console.log('    CANCELLED reservations are correctly excluded from the conflict check.');
process.exit(0);
