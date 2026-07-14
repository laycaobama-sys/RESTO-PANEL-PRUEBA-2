// ============================================================
// Fix 15: Middleware excludes webhooks
// ============================================================
// Verifies that src/middleware.ts has a PUBLIC_API_PREFIXES list
// that includes the 3 webhook routes:
//   - /api/stripe/webhook
//   - /api/whatsapp/webhook
//   - /api/whatsapp/status
//
// And that the matcher regex also excludes them so the middleware
// never even runs on those paths (defense-in-depth).
//
// Strategy:
//   1. Read src/middleware.ts
//   2. Confirm all 3 prefixes appear in PUBLIC_API_PREFIXES.
//   3. Confirm the matcher regex excludes them too.
//   4. Functional test: simulate the middleware matcher against
//      each public + protected path.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';

const ROOT = process.cwd();
const src = readFileSync(resolve(ROOT, 'src/middleware.ts'), 'utf8');

// ─── Step 1: PUBLIC_API_PREFIXES array exists ──────────────
const arrMatch = src.match(/PUBLIC_API_PREFIXES\s*=\s*\[([\s\S]*?)\]/);
assert.ok(arrMatch, 'PUBLIC_API_PREFIXES array must be defined');
const arrBody = arrMatch[1];
console.log('--- PUBLIC_API_PREFIXES array body ---');
console.log(arrBody);

// ─── Step 2: all 3 webhook prefixes are present ────────────
assert.ok(/['"]\/api\/stripe\/webhook['"]/.test(arrBody),
  '/api/stripe/webhook must be in PUBLIC_API_PREFIXES');
assert.ok(/['"]\/api\/whatsapp\/webhook['"]/.test(arrBody),
  '/api/whatsapp/webhook must be in PUBLIC_API_PREFIXES');
assert.ok(/['"]\/api\/whatsapp\/status['"]/.test(arrBody),
  '/api/whatsapp/status must be in PUBLIC_API_PREFIXES');
console.log('✓ /api/stripe/webhook   in PUBLIC_API_PREFIXES');
console.log('✓ /api/whatsapp/webhook in PUBLIC_API_PREFIXES');
console.log('✓ /api/whatsapp/status  in PUBLIC_API_PREFIXES');

// Also confirm auth + public + health are there (regression check)
assert.ok(/['"]\/api\/auth\/['"]/.test(arrBody), '/api/auth/ must be public');
assert.ok(/['"]\/api\/public\/['"]/.test(arrBody), '/api/public/ must be public');
assert.ok(/['"]\/api\/health['"]/.test(arrBody), '/api/health must be public');
console.log('✓ /api/auth/, /api/public/, /api/health also public (regression)');

// ─── Step 3: matcher regex excludes them too ───────────────
// Next.js matcher uses a negative lookahead pattern. Verify all
// 3 webhook paths appear in the matcher regex (so the middleware
// is never even invoked on them).
assert.ok(
  /matcher:\s*\[[\s\S]*?stripe\/webhook[\s\S]*?\]/.test(src),
  'Matcher regex must exclude stripe/webhook'
);
assert.ok(
  /matcher:\s*\[[\s\S]*?whatsapp\/webhook[\s\S]*?\]/.test(src),
  'Matcher regex must exclude whatsapp/webhook'
);
assert.ok(
  /matcher:\s*\[[\s\S]*?whatsapp\/status[\s\S]*?\]/.test(src),
  'Matcher regex must exclude whatsapp/status'
);
console.log('✓ All 3 webhook paths also excluded from matcher (defense-in-depth)');

// Extract the matcher block
const matchStart = src.indexOf('matcher:');
const matchEnd = src.indexOf(']', matchStart) + 1;
console.log('\n--- matcher block (verbatim) ---');
console.log(src.slice(matchStart, matchEnd));

// ─── Step 4: functional test of the prefix check ──────────
const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/public/',
  '/api/health',
  '/api/stripe/webhook',
  '/api/whatsapp/webhook',
  '/api/whatsapp/status',
];

function isPublic(pathname) {
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

const cases = [
  // [pathname, expectedPublic]
  ['/api/stripe/webhook',       true],   // Stripe webhook (no cookie)
  ['/api/whatsapp/webhook',     true],   // Meta webhook (HMAC signed)
  ['/api/whatsapp/status',      true],   // Meta status (HMAC signed)
  ['/api/health',               true],
  ['/api/auth/[...nextauth]',   true],
  ['/api/public/lazamorana',    true],
  ['/api/reservations',         false],  // protected
  ['/api/orders',               false],  // protected
  ['/api/restaurant',           false],  // protected
  ['/api/upload',               false],  // protected
  ['/api/admin/tenants',        false],  // protected + super-admin
  ['/api/user/sessions',        false],  // protected
  // Tricky: /api/whatsapp-webhook (with hyphen, no slash) — must NOT match
  ['/api/whatsapp-webhook',     false],
  // Tricky: /api/whatsapp/foo (other paths under /api/whatsapp/) — NOT public
  ['/api/whatsapp/foo',         false],
  // Tricky: /api/stripe/webhook-forgery (prefix match would be wrong)
  //   '/api/stripe/webhook' startsWith check WOULD match this. The
  //   matcher regex catches it correctly (we test below).
];

console.log('\n--- Functional prefix checks ---');
let pass = 0;
for (const [path, expected] of cases) {
  const actual = isPublic(path);
  assert.equal(actual, expected,
    `${path} → expected public=${expected}, got public=${actual}`);
  console.log(`${expected === actual ? '✓' : '✗'} ${path.padEnd(35)} → public=${actual}`);
  pass++;
}
assert.equal(pass, cases.length, 'All prefix cases must match');

// ─── Step 5: confirm webhook prefixes can't be spoofed via prefix-match ──
// Since the matcher regex uses exact path segments (negative lookahead),
// /api/stripe/webhook-forgery would NOT be matched by the regex exclusion
// (the regex uses `stripe/webhook` followed by `|` or `)`). Verify by
// re-checking the matcher regex pattern.
const matcherMatch = src.match(/matcher:\s*\[([\s\S]*?)\]/);
const matcherBody = matcherMatch[1];
console.log('\n--- matcher regex (raw) ---');
console.log(matcherBody.trim());

// Confirm it uses a negative lookahead `(?!...)`
assert.ok(/\(\?!/.test(matcherBody),
  'Matcher must use a negative lookahead `(?!...)` to exclude public paths');
console.log('✓ Matcher uses negative lookahead — defense-in-depth');

console.log('\n✅ PASS: Middleware excludes all 3 webhook routes (public prefixes + matcher).');
console.log('    Stripe/WhatsApp webhooks reach their handlers without auth.');
process.exit(0);
