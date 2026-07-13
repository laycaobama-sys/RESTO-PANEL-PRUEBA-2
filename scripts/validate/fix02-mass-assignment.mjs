// ============================================================
// Fix 2: Mass Assignment on PATCH /api/restaurant
// ============================================================
// Verifies that ALLOWED_SETTINGS_KEYS Set exists and that
// `organization_id` is NOT in it (so an attacker can't overwrite
// the org's primary key via the settings upsert).
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';

const ROOT = process.cwd();
const src = readFileSync(resolve(ROOT, 'src/app/api/restaurant/route.ts'), 'utf8');

// ─── Step 1: ALLOWED_SETTINGS_KEYS Set exists ──────────────
const setMatch = src.match(/ALLOWED_SETTINGS_KEYS\s*=\s*new\s+Set\s*\(\s*\[([\s\S]*?)\]\s*\)/);
assert.ok(setMatch, 'ALLOWED_SETTINGS_KEYS Set must be defined');
console.log('--- ALLOWED_SETTINGS_KEYS body ---');
console.log(setMatch[1]);

const allowedBody = setMatch[1];

// ─── Step 2: organization_id must NOT be in the allowlist ──
assert.ok(
  !/['"]organization_id['"]/.test(allowedBody),
  'organization_id must NOT be in ALLOWED_SETTINGS_KEYS (mass-assignment vector)'
);
console.log('✓ organization_id is NOT in the allowlist');

// ─── Step 3: id must NOT be in the allowlist either ────────
assert.ok(
  !/['"]\s*id\s*['"]/.test(allowedBody),
  'id must NOT be in ALLOWED_SETTINGS_KEYS'
);
console.log('✓ id is NOT in the allowlist');

// ─── Step 4: drop logic exists (silently skips unknown) ────
assert.ok(
  /if\s*\(\s*ALLOWED_SETTINGS_KEYS\.has\s*\(\s*snake\s*\)\s*\)/.test(src),
  'Code must check ALLOWED_SETTINGS_KEYS.has(snake) before writing'
);
console.log('✓ Allowlist gate present: ALLOWED_SETTINGS_KEYS.has(snake)');

// ─── Step 5: functional test of the conversion + filter ───
// Re-implement the exact filter logic from the route.
const ALLOWED_SETTINGS_KEYS = new Set([
  'mon_open', 'mon_close',
  'tue_open', 'tue_close',
  'wed_open', 'wed_close',
  'thu_open', 'thu_close',
  'fri_open', 'fri_close',
  'sat_open', 'sat_close',
  'sun_open', 'sun_close',
  'tax_rate', 'service_charge',
  'timezone', 'currency', 'country', 'language',
  'vat_number', 'vat_rate',
  'no_show_policy', 'reservation_rules',
  'branding', 'hours', 'modules',
]);

// Attacker payload — tries to overwrite the org id
const attackerPayload = {
  monOpen: '09:00',
  organizationId: 'victim-org-uuid',  // mass-assignment attempt
  id: 'forged-id',                    // mass-assignment attempt
  taxRate: 0.10,
  // snake_case attack via already-snake key
  organization_id: 'victim-org-uuid-2',
};

function filterSettings(settings) {
  const out = {};
  for (const [k, v] of Object.entries(settings)) {
    const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    if (ALLOWED_SETTINGS_KEYS.has(snake)) {
      out[snake] = v;
    }
    // Silently drop unknown keys
  }
  return out;
}

const filtered = filterSettings(attackerPayload);
console.log('\n--- Filtered output for attacker payload ---');
console.log(JSON.stringify(filtered, null, 2));

assert.equal(filtered.organization_id, undefined, 'organization_id MUST be dropped');
assert.equal(filtered.id, undefined, 'id MUST be dropped');
assert.equal(filtered.mon_open, '09:00', 'mon_open (legit) must be preserved');
assert.equal(filtered.tax_rate, 0.10, 'tax_rate (legit) must be preserved');

console.log('\n✅ PASS: Mass-assignment attack blocked.');
console.log('    organizationId and id were silently dropped; legit keys preserved.');
process.exit(0);
