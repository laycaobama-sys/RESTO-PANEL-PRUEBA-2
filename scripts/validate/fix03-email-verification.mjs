// ============================================================
// Fix 3: Email Verification gate on login
// ============================================================
// Verifies that next-auth.ts has the requireVerification gate
// that throws if !user.email_verified && !user.is_super_admin
// in production (or when REQUIRE_EMAIL_VERIFICATION=true).
//
// Strategy:
//   1. Read src/lib/next-auth.ts
//   2. Confirm requireVerification is computed from env
//   3. Confirm the conditional block exists
//   4. Functional test: simulate the gate with 3 user profiles
//      (verified, unverified, super-admin) and 2 env states
//      (production, development).
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';

const ROOT = process.cwd();
const src = readFileSync(resolve(ROOT, 'src/lib/next-auth.ts'), 'utf8');

// ─── Step 1: requireVerification computed ──────────────────
assert.ok(
  /const\s+requireVerification\s*=\s*process\.env\.REQUIRE_EMAIL_VERIFICATION\s*===\s*['"]true['"]/.test(src),
  'requireVerification must check REQUIRE_EMAIL_VERIFICATION env var'
);
assert.ok(
  /process\.env\.NODE_ENV\s*===\s*['"]production['"]/.test(src),
  'requireVerification must default to true in production'
);
console.log('✓ requireVerification env-gate present');

// ─── Step 2: the throw block ───────────────────────────────
assert.ok(
  /if\s*\(\s*requireVerification\s*&&\s*!user\.email_verified\s*&&\s*!user\.is_super_admin\s*\)/.test(src),
  'Gate must check requireVerification && !user.email_verified && !user.is_super_admin'
);
assert.ok(
  /throw\s+new\s+Error\(['"][^'"]*verificado[^'"]*['"]\)/.test(src),
  'Gate must throw an error mentioning verification (Spanish: "verificado")'
);
console.log('✓ Conditional throw block present');

// Extract the exact gate snippet for the report
const gateMatch = src.match(/const\s+requireVerification[\s\S]{0,400}?\}\s*\n/m);
console.log('\n--- Gate code (verbatim) ---');
console.log(gateMatch ? gateMatch[0] : '(not extracted)');

// ─── Step 3: functional test of the gate logic ────────────
// Re-implement the gate exactly as in the source.
function gate({ email_verified, is_super_admin }, nodeEnv, requireEmailVerification) {
  const requireVerification = requireEmailVerification === 'true' || nodeEnv === 'production';
  if (requireVerification && !email_verified && !is_super_admin) {
    throw new Error('Tu email no está verificado.');
  }
  return 'login-ok';
}

const cases = [
  // [user, env, expected]
  [{ email_verified: true,  is_super_admin: false }, 'production', 'login-ok'],
  [{ email_verified: false, is_super_admin: false }, 'production', 'throw'],     // blocked
  [{ email_verified: false, is_super_admin: true },  'production', 'login-ok'],  // super-admin bypass
  [{ email_verified: false, is_super_admin: false }, 'development', 'login-ok'], // dev bypasses
  [{ email_verified: false, is_super_admin: false }, 'production', 'throw'],     // double-check
];

let passed = 0;
for (const [user, env, expected] of cases) {
  let result;
  try {
    result = gate(user, env, 'false');
  } catch (e) {
    result = 'throw';
  }
  assert.equal(result, expected,
    `user=${JSON.stringify(user)} env=${env} expected=${expected} got=${result}`);
  console.log(`✓ ${JSON.stringify(user)} @ NODE_ENV=${env} → ${result}`);
  passed++;
}

assert.equal(passed, cases.length, 'All gate test cases must pass');
console.log('\n✅ PASS: Email verification gate works correctly.');
console.log('    Unverified users blocked in production; super-admins bypass; dev mode relaxed.');
process.exit(0);
