// ============================================================
// Fix 13: order_items.menu_item_id nullable
// ============================================================
// Verifies that migration 0019_phase_audit_fixes.sql contains:
//   ALTER TABLE order_items ALTER COLUMN menu_item_id DROP NOT NULL;
//
// This unblocks the ON DELETE SET NULL FK behavior that 0018
// tried to add but couldn't (because the column was still NOT
// NULL → impossibility).
//
// Strategy:
//   1. Read the migration.
//   2. Confirm the exact ALTER statement.
//   3. Confirm it targets order_items.menu_item_id specifically.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';

const ROOT = process.cwd();
const sqlPath = resolve(ROOT, 'supabase/migrations/0019_phase_audit_fixes.sql');
const src = readFileSync(sqlPath, 'utf8');

// ─── Step 1: exact ALTER statement present ─────────────────
const alterRegex = /ALTER\s+TABLE\s+order_items\s+ALTER\s+COLUMN\s+menu_item_id\s+DROP\s+NOT\s+NULL\s*;/i;
assert.ok(alterRegex.test(src),
  'Must contain: ALTER TABLE order_items ALTER COLUMN menu_item_id DROP NOT NULL;');
console.log('✓ ALTER TABLE order_items ALTER COLUMN menu_item_id DROP NOT NULL; — present');

// Extract the line for the report
const lines = src.split('\n');
const alterLineIdx = lines.findIndex(l => alterRegex.test(l));
console.log('\n--- Context around the ALTER (lines around match) ---');
for (let i = Math.max(0, alterLineIdx - 2); i < Math.min(lines.length, alterLineIdx + 2); i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}

// ─── Step 2: there must be exactly ONE such statement ─────
const matches = src.match(new RegExp(alterRegex.source, 'gi'));
assert.equal(matches.length, 1, `Exactly one DROP NOT NULL on menu_item_id expected; got ${matches.length}`);
console.log(`\n✓ Exactly one occurrence (no duplicate ALTERs)`);

// ─── Step 3: idempotency check ─────────────────────────────
// The DROP NOT NULL is idempotent by nature in Postgres (running
// it twice on an already-nullable column is a no-op), so no
// IF NOT EXISTS clause is needed. But we should confirm no
// conflicting SET NOT NULL on the same column exists elsewhere.
const setNotNullMatch = src.match(/ALTER\s+TABLE\s+order_items\s+ALTER\s+COLUMN\s+menu_item_id\s+SET\s+NOT\s+NULL/i);
assert.ok(!setNotNullMatch,
  'Migration must NOT also re-add SET NOT NULL on the same column (would undo the fix)');
console.log('✓ No conflicting SET NOT NULL on order_items.menu_item_id');

// ─── Step 4: confirm 0018 (predecessor) had the FK that needs this ──
// Read the 0018 migration to verify the FK with ON DELETE SET NULL
// exists there (so this fix is actually necessary, not redundant).
const path18 = resolve(ROOT, 'supabase/migrations/0018_audit_fixes.sql');
let src18 = '';
try {
  src18 = readFileSync(path18, 'utf8');
} catch {
  console.log('! 0018_audit_fixes.sql not found — skipping cross-check');
}

if (src18) {
  const fkMatch = src18.match(/ALTER\s+TABLE\s+order_items[\s\S]{0,500}?ON\s+DELETE\s+SET\s+NULL/i);
  if (fkMatch) {
    console.log('✓ 0018 declared an ON DELETE SET NULL FK on order_items — fix is needed');
    console.log('  (0018 changed the FK, but the column was still NOT NULL → SET NULL was impossible)');
  }
}

console.log('\n✅ PASS: order_items.menu_item_id is now nullable, unblocking ON DELETE SET NULL.');
process.exit(0);
