// ============================================================
// Master validator: runs all 15 fix validators and prints a summary.
// ============================================================

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const fixes = [
  ['Fix 1',  'fix01-idor-sessions.mjs',                'IDOR on DELETE /api/user/sessions'],
  ['Fix 2',  'fix02-mass-assignment.mjs',              'Mass Assignment on PATCH /api/restaurant'],
  ['Fix 3',  'fix03-email-verification.mjs',           'Email Verification gate on login'],
  ['Fix 4',  'fix04-overbooking.mjs',                  'Overbooking check on POST /api/reservations'],
  ['Fix 5',  'fix05-feature-flags.mjs',                'Feature Flags respect subscription status'],
  ['Fix 6',  'fix06-stripe-duplicate.mjs',             'Stripe checkout prevents duplicate subscriptions'],
  ['Fix 7',  'fix07-whatsapp-webhook.mjs',             'WhatsApp webhook processes ALL messages'],
  ['Fix 8',  'fix08-queue-processor.mjs',              'Queue Processor started in instrumentation'],
  ['Fix 9',  'fix09-upload-api.mjs',                   'Upload API exists with type/size validation'],
  ['Fix 10', 'fix10-error-boundaries.mjs',             'Error boundaries (error/not-found/global-error)'],
  ['Fix 11', 'fix11-reset-password-revocation.mjs',    'Session Revocation in reset-password'],
  ['Fix 12', 'fix12-customer-metrics.mjs',             'Customer Metrics with 3 branches'],
  ['Fix 13', 'fix13-menu-item-id-nullable.mjs',        'order_items.menu_item_id nullable'],
  ['Fix 14', 'fix14-rate-limits.mjs',                  'Rate Limits in forgot-password and register'],
  ['Fix 15', 'fix15-middleware-webhooks.mjs',          'Middleware excludes webhooks'],
];

const results = [];
for (const [id, file, name] of fixes) {
  const path = resolve(process.cwd(), 'scripts/validate', file);
  const r = spawnSync('node', [path], { encoding: 'utf8' });
  const ok = r.status === 0;
  results.push({ id, name, ok, file });
  const tag = ok ? '✅ PASS' : '❌ FAIL';
  console.log(`${tag}  ${id}: ${name}`);
  if (!ok) {
    console.log('  stderr:', r.stderr?.slice(0, 800));
    console.log('  stdout (tail):', r.stdout?.split('\n').slice(-6).join('\n'));
  }
}

console.log('\n=== SUMMARY ===');
const passed = results.filter(r => r.ok).length;
const failed = results.length - passed;
console.log(`Passed: ${passed}/${results.length}`);
console.log(`Failed: ${failed}/${results.length}`);
if (failed > 0) {
  console.log('\nFailed fixes:');
  results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.id}: ${r.name} (${r.file})`));
  process.exit(1);
} else {
  console.log('\n🎉 ALL 15 FIXES VALIDATED.');
  process.exit(0);
}
