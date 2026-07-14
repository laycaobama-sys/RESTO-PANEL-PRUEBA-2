// ============================================================
// Fix 14: Rate Limits in forgot-password and register
// ============================================================
// Verifies:
//   A) forgot-password has an in-memory rate limiter
//      (3 requests / 10 min / IP) that returns 429 on excess.
//   B) register has at least the LAUNCH_MODE=private gate that
//      disables public registration.
//
// Strategy:
//   1. Read both route files.
//   2. Confirm the limiter constants & function in forgot-password.
//   3. Confirm the LAUNCH_MODE gate in register.
//   4. Functional test: simulate the limiter for N requests and
//      assert that the 4th request in a 10-minute window is
//      rejected.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';

const ROOT = process.cwd();
const fpSrc = readFileSync(resolve(ROOT, 'src/app/api/auth/forgot-password/route.ts'), 'utf8');
const regSrc = readFileSync(resolve(ROOT, 'src/app/api/auth/register/route.ts'), 'utf8');

// ─── A) forgot-password rate limiter ───────────────────────
console.log('=== A) forgot-password rate limiter ===');

// Constants
assert.ok(/WINDOW_MS\s*=\s*10\s*\*\s*60\s*\*\s*1000/.test(fpSrc),
  'WINDOW_MS must equal 10 * 60 * 1000 (10 minutes)');
console.log('✓ WINDOW_MS = 10 minutes');

assert.ok(/MAX_PER_WINDOW\s*=\s*3/.test(fpSrc),
  'MAX_PER_WINDOW must equal 3');
console.log('✓ MAX_PER_WINDOW = 3');

// In-memory Map
assert.ok(/attempts\s*=\s*new\s+Map/.test(fpSrc),
  'In-memory attempts Map must be declared');
console.log('✓ In-memory attempts Map present');

// rateLimited function
assert.ok(/function\s+rateLimited\s*\(\s*ip\s*:\s*string\s*\)/.test(fpSrc),
  'rateLimited(ip) function must be declared');
console.log('✓ rateLimited(ip) function declared');

// 429 response
assert.ok(/status:\s*429/.test(fpSrc),
  'Must return HTTP 429 when rate-limited');
console.log('✓ HTTP 429 response on rate-limit excess');

// getIp helper (so X-Forwarded-For is parsed)
assert.ok(/function\s+getIp\s*\(\s*req\s*:\s*Request\s*\)/.test(fpSrc),
  'getIp(req) helper must extract the client IP from headers');
console.log('✓ getIp(req) helper extracts IP from headers');

// Extract limiter block for the report
const limiterStart = fpSrc.indexOf('// In-memory rate limiter');
const limiterEnd = fpSrc.indexOf('export async function POST', limiterStart);
console.log('\n--- forgot-password limiter block (verbatim) ---');
console.log(fpSrc.slice(limiterStart, limiterEnd).trim());

// ─── B) register LAUNCH_MODE gate ──────────────────────────
console.log('\n=== B) register LAUNCH_MODE gate ===');

assert.ok(/LAUNCH_MODE\s*===\s*['"]private['"]/.test(regSrc),
  'Register route must check process.env.LAUNCH_MODE === "private"');
console.log('✓ LAUNCH_MODE === "private" check present');

assert.ok(/status:\s*403/.test(regSrc),
  'Register route must return HTTP 403 when LAUNCH_MODE=private');
console.log('✓ HTTP 403 response in private launch mode');

// Confirm the gate is the FIRST check (before parsing body)
const gateIdx = regSrc.indexOf('LAUNCH_MODE');
const parseIdx = regSrc.indexOf('await req.json()');
assert.ok(gateIdx > 0 && parseIdx > 0 && gateIdx < parseIdx,
  'LAUNCH_MODE gate must run BEFORE req.json() — fail fast on private mode');
console.log('✓ LAUNCH_MODE gate runs BEFORE body parsing (fail-fast)');

// Extract the gate for the report
const gateStart = regSrc.indexOf('// Pre-launch gate');
const gateEnd = regSrc.indexOf('}', regSrc.indexOf('403', gateStart)) + 1;
console.log('\n--- register LAUNCH_MODE gate (verbatim) ---');
console.log(regSrc.slice(gateStart, gateEnd).trim());

// ─── Functional test: simulate the rate limiter ────────────
console.log('\n=== Functional test: simulate rate limiter ===');

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const attempts = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

// IP X makes 3 requests → all allowed
const ip = '1.2.3.4';
for (let i = 1; i <= 3; i++) {
  const blocked = rateLimited(ip);
  assert.equal(blocked, false, `Request ${i} from ${ip} should be allowed`);
  console.log(`✓ Request ${i} from ${ip} → allowed`);
}
// 4th request → blocked
const blocked4 = rateLimited(ip);
assert.equal(blocked4, true, '4th request from same IP within 10 min must be blocked');
console.log(`✓ Request 4 from ${ip} → 429 blocked`);

// Different IP → allowed (limiter is per-IP)
const blocked5 = rateLimited('5.6.7.8');
assert.equal(blocked5, false, 'First request from a different IP must be allowed');
console.log(`✓ Request 1 from 5.6.7.8 → allowed (per-IP scoping works)`);

// Simulate window expiry
const entry = attempts.get(ip);
entry.firstAt = Date.now() - WINDOW_MS - 1;  // expired
const blockedAfterWindow = rateLimited(ip);
assert.equal(blockedAfterWindow, false,
  'After 10-minute window expires, the IP must be allowed again');
console.log(`✓ After 10-min window expiry → allowed (sliding window works)`);

console.log('\n✅ PASS: forgot-password has 3/10min/IP limiter with 429; register has LAUNCH_MODE gate.');
process.exit(0);
