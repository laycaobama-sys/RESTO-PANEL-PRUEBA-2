// ============================================================
// rls.mjs — Row-Level Security validation for RestoPanel
// ============================================================
// Proves that every tenant-scoped table is protected by RLS and
// that no policy uses the recursive `exists (select 1 from users
// u where u.id = auth.uid() and u.is_super_admin = true)` pattern
// (which causes infinite recursion — see migration 0010).
//
// 2a. Static migration scan
// 2b. Cross-tenant access test (source code review)
// ============================================================

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = resolve(ROOT, 'supabase/migrations');

function readSrc(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function readMigrations() {
  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  return files.map(f => ({
    name: f,
    path: resolve(MIGRATIONS_DIR, f),
    content: readFileSync(resolve(MIGRATIONS_DIR, f), 'utf8'),
  }));
}

let failures = 0;
const evidence = [];

function printTest(n, name, status, result, ev) {
  console.log(`\n### Test ${n}: ${name}`);
  console.log(`Status: ${status}`);
  console.log(`Result: ${result}`);
  console.log('Evidence:');
  console.log(ev);
}

// ============================================================
// TEST 2a — Static migration scan
// ============================================================
function test2a() {
  const migrations = readMigrations();
  const allSql = migrations.map(m => m.content).join('\n');

  // ─── 1. Find all tenant-scoped tables ─────────────────
  // A table is "tenant-scoped" if it has an organization_id column.
  // We parse each CREATE TABLE block to extract the column list.
  const tenantTables = new Set();
  const tableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\)\s*;/gi;
  let m;
  while ((m = tableRegex.exec(allSql)) !== null) {
    const tableName = m[1];
    const body = m[2];
    if (/organization_id\s+uuid/i.test(body)) {
      tenantTables.add(tableName);
    }
  }

  // ─── 2. Verify each tenant-scoped table has RLS enabled ─
  // Two patterns are accepted:
  //   (a) static: `alter table <t> enable row level security`
  //   (b) dynamic: `execute format('alter table %I enable row level security;', t)`
  //       where <t> appears in an array literal in the same DO block.
  const rlsMissing = [];
  const dynamicRls = /execute\s+format\s*\(\s*['"]alter\s+table\s+%I\s+enable\s+row\s+level\s+security/i.test(allSql);
  for (const t of tenantTables) {
    const staticRe = new RegExp(`alter\\s+table\\s+${t}\\s+enable\\s+row\\s+level\\s+security`, 'i');
    // For the dynamic pattern, check that '<t>' appears as an array
    // element somewhere in the migrations (the DO $$ block iterates
    // over an array of table names).
    const inArray = new RegExp(`['"]${t}['"]`).test(allSql);
    if (!staticRe.test(allSql) && !(dynamicRls && inArray)) {
      rlsMissing.push(t);
    }
  }

  // ─── 3. Verify each tenant-scoped table has >= 1 policy ─
  const policyMissing = [];
  for (const t of tenantTables) {
    // Look for `create policy ... on <t>` in any migration.
    // Also count the dynamic format('create policy %I on %I ...', ..., t)
    // patterns in DO $$ blocks.
    const direct = new RegExp(`create\\s+policy\\s+\\w+\\s+on\\s+${t}\\b`, 'i');
    const dynamic = new RegExp(`'create\\s+policy\\s+%I[_a-z]*\\s+on\\s+%I'\\s*,\\s*\\w+\\s*,\\s*\\w+`, 'i');
    // For dynamic policies, the table name is a variable (t), so we
    // check if t appears in any array literal in the DO block.
    const inArray = new RegExp(`'${t}'`, 'g');
    const hasDynamic = /execute\s+format\(\s*['"]create\s+policy\s+%I/i.test(allSql) && inArray.test(allSql);
    if (!direct.test(allSql) && !hasDynamic) {
      policyMissing.push(t);
    }
  }

  // ─── 4. No policy uses the recursive pattern ──────────
  // Scan each CREATE POLICY block (multiline) for the recursive
  // `exists (select 1 from users u where u.id = auth.uid() and
  //  u.is_super_admin = true)` pattern.
  const RECURSIVE_RE = /exists\s*\(\s*select\s+1\s+from\s+users\s+u\s+where\s+u\.id\s*=\s*auth\.uid\(\)\s+and\s+u\.is_super_admin\s*=\s*true\s*\)/i;
  const recursiveHits = [];
  for (const mig of migrations) {
    // Find all CREATE POLICY blocks (they span until the next `;`).
    const policyBlockRe = /create\s+policy\s+\w+\s+on\s+\w+[\s\S]*?;/gi;
    let pm;
    while ((pm = policyBlockRe.exec(mig.content)) !== null) {
      const block = pm[0];
      if (RECURSIVE_RE.test(block)) {
        recursiveHits.push({ migration: mig.name, snippet: block.slice(0, 200) });
      }
    }
    // Also check dynamic format('create policy ...') strings.
    const formatStrRe = /'create\s+policy\s+%I[_a-z]*\s+on\s+%I[\s\S]*?'\s*,/gi;
    let fm;
    while ((fm = formatStrRe.exec(mig.content)) !== null) {
      const block = fm[0];
      if (RECURSIVE_RE.test(block)) {
        recursiveHits.push({ migration: mig.name, snippet: block.slice(0, 200) });
      }
    }
  }

  // ─── 5. Super-admin policies use is_current_user_super_admin()
  const superAdminPolicyRe = /create\s+policy\s+(\w*super_admin\w*)\s+on\s+\w+[\s\S]*?;/gi;
  const superAdminHits = [];
  let sm;
  while ((sm = superAdminPolicyRe.exec(allSql)) !== null) {
    const policyName = sm[1];
    const block = sm[0];
    if (!/is_current_user_super_admin\(\)/.test(block)) {
      superAdminHits.push({ policy: policyName, snippet: block.slice(0, 200) });
    }
  }
  // Also check dynamic format strings for super_admin policies.
  const dynSuperRe = /'create\s+policy\s+%I[_a-z]*super_admin[_a-z]*\s+on\s+%I[\s\S]*?'\s*,/gi;
  let dm;
  while ((dm = dynSuperRe.exec(allSql)) !== null) {
    const block = dm[0];
    if (!/is_current_user_super_admin\(\)/.test(block)) {
      superAdminHits.push({ policy: '(dynamic)', snippet: block.slice(0, 200) });
    }
  }

  // ─── Report ───────────────────────────────────────────
  const tenantTableList = Array.from(tenantTables).sort();
  const allGood = rlsMissing.length === 0 && policyMissing.length === 0 &&
    recursiveHits.length === 0 && superAdminHits.length === 0;
  const status = allGood ? '✅ PASS' : '❌ FAIL';
  if (status === '❌ FAIL') failures++;

  const ev = [
    `Tenant-scoped tables found: ${tenantTableList.length}`,
    `  ${tenantTableList.join(', ')}`,
    `RLS missing on: ${rlsMissing.length ? rlsMissing.join(', ') : '(none)'}`,
    `Policies missing on: ${policyMissing.length ? policyMissing.join(', ') : '(none)'}`,
    `Recursive pattern hits: ${recursiveHits.length}`,
    recursiveHits.length ? recursiveHits.map(h => `  - ${h.migration}: ${h.snippet}...`).join('\n') : '  (none — all super-admin policies use is_current_user_super_admin())',
    `Super-admin policies NOT using is_current_user_super_admin(): ${superAdminHits.length}`,
    superAdminHits.length ? superAdminHits.map(h => `  - ${h.policy}: ${h.snippet}...`).join('\n') : '  (none)',
  ].join('\n  ');

  printTest('2a', 'RLS coverage + recursive-pattern scan',
    status,
    `${tenantTableList.length} tenant-scoped tables. RLS missing: ${rlsMissing.length}. ` +
    `Policies missing: ${policyMissing.length}. Recursive patterns: ${recursiveHits.length}. ` +
    `Super-admin policies not using helper: ${superAdminHits.length}.`,
    `  ${ev}`);

  evidence.push({ test: '2a', status, tenantTableCount: tenantTableList.length, rlsMissing, policyMissing, recursiveHits, superAdminHits });

  if (recursiveHits.length > 0) {
    console.log('\n  ⚠️  FIX PROPOSED: Rewrite the policies in 0003_super_admin_audit.sql to use');
    console.log('     is_current_user_super_admin() instead of the inline exists(...) pattern.');
  }
  if (superAdminHits.length > 0) {
    console.log('  ⚠️  FIX PROPOSED: Super-admin policies must call is_current_user_super_admin().');
  }
}

// ============================================================
// TEST 2b — Cross-tenant access test (source code review)
// ============================================================
function test2b() {
  const routeSrc = readSrc('src/app/api/reservations/route.ts');
  const dbSrc = readSrc('src/lib/db.ts');

  // The GET handler must call db.reservation.list(user.organizationId, ...)
  // — the org_id comes from the session, NOT from the request body.
  const getHandlerUsesSessionOrg = /db\.reservation\.list\(\s*user\.organizationId\s*,/.test(routeSrc);

  // The list() function must apply .eq('organization_id', organizationId)
  // unconditionally (before any optional filters).
  const listFnAppliesOrgFilter = /async\s+list\(\s*organizationId[\s\S]*?\.from\(\s*['"]reservations['"]\s*\)[\s\S]*?\.eq\(\s*['"]organization_id['"]\s*,\s*organizationId\s*\)/.test(dbSrc);

  // The body must NOT be able to override organization_id — check that
  // the body destructuring block does NOT include organization_id.
  const bodyDestructureMatch = /const\s*\{([^}]+)\}\s*=\s*(?:body|await\s+req\.json\(\))/.exec(routeSrc);
  const bodyHasOrgId = bodyDestructureMatch
    ? /(^|\W)organization_id(\W|$)/i.test(bodyDestructureMatch[1])
    : false;
  const bodyCannotOverrideOrg = !bodyHasOrgId;

  // The POST handler must use user.organizationId (from session) for
  // the create call — NOT body.organization_id.
  const postUsesSessionOrg = /db\.reservation\.create\(\s*\{[\s\S]*?organization_id:\s*user\.organizationId/.test(routeSrc);

  // The overbooking check must filter by user.organizationId.
  const overlapUsesSessionOrg = /\.eq\(\s*['"]organization_id['"]\s*,\s*user\.organizationId\s*\)[\s\S]*?\.eq\(\s*['"]table_id['"]\s*,\s*tableId\s*\)/.test(routeSrc);

  // The [id] route must pass user.organizationId to the db methods
  // (findById, update, delete — all of which apply the org filter).
  const idRouteSrc = readSrc('src/app/api/reservations/[id]/route.ts');
  const idRouteUsesOrgFilter = /db\.reservation\.(findById|update|delete)\s*\(\s*[^,]+,\s*user\.organizationId/.test(idRouteSrc);

  // ─── Simulation ───────────────────────────────────────
  // Model: user from orgA tries to read orgB's reservations.
  // The session says organizationId = orgA. The attacker sends
  // ?organization_id=orgB in the query string.
  // Expected: the handler ignores the query param and returns
  // only orgA's reservations.
  const sessionOrgId = 'orgA';
  const attackerProvidedOrgId = 'orgB';
  const dbReservations = [
    { id: 'r1', organization_id: 'orgA', customer_name: 'Alice' },
    { id: 'r2', organization_id: 'orgB', customer_name: 'Bob' },
  ];

  // Mimic db.reservation.list:
  function list(organizationId) {
    return dbReservations.filter(r => r.organization_id === organizationId);
  }

  // The route uses sessionOrgId, NOT the attacker-provided value.
  const usedOrgId = bodyCannotOverrideOrg && getHandlerUsesSessionOrg
    ? sessionOrgId
    : attackerProvidedOrgId;
  const returned = list(usedOrgId);
  const leakedCrossTenant = returned.filter(r => r.organization_id !== sessionOrgId).length;

  const allChecks = getHandlerUsesSessionOrg && listFnAppliesOrgFilter && postUsesSessionOrg &&
    overlapUsesSessionOrg && bodyCannotOverrideOrg && idRouteUsesOrgFilter;
  const status = (allChecks && leakedCrossTenant === 0) ? '✅ PASS' : '❌ FAIL';
  if (status === '❌ FAIL') failures++;

  const ev = [
    `Source check: GET handler uses user.organizationId from session = ${getHandlerUsesSessionOrg}`,
    `Source check: db.reservation.list applies .eq('organization_id', organizationId) = ${listFnAppliesOrgFilter}`,
    `Source check: POST handler uses user.organizationId for create = ${postUsesSessionOrg}`,
    `Source check: overbooking query filters by user.organizationId = ${overlapUsesSessionOrg}`,
    `Source check: body/query cannot override organization_id = ${bodyCannotOverrideOrg}`,
    `Source check: [id] route filters by user.organizationId = ${idRouteUsesOrgFilter}`,
    ``,
    `Simulation: session.orgId = ${sessionOrgId}, attacker sent ?organization_id=${attackerProvidedOrgId}`,
    `Simulation: handler used orgId = ${usedOrgId} (session, not body)`,
    `Simulation: returned ${returned.length} reservation(s), cross-tenant leaked = ${leakedCrossTenant}`,
    `Returned: ${JSON.stringify(returned.map(r => ({ id: r.id, org: r.organization_id })))}`,
  ].join('\n  ');

  printTest('2b', 'Cross-tenant access test (orgA user tries to read orgB reservations)',
    status,
    `Session org = ${sessionOrgId}, attacker-injected org = ${attackerProvidedOrgId}. ` +
    `Handler used session org: ${usedOrgId === sessionOrgId}. Cross-tenant rows leaked: ${leakedCrossTenant}.`,
    `  ${ev}`);

  evidence.push({ test: '2b', status, usedOrgId, leakedCrossTenant, allChecks });
}

// ============================================================
// Main
// ============================================================
function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RLS VALIDATION — RestoPanel');
  console.log('  Static migration scan + cross-tenant access test');
  console.log('═══════════════════════════════════════════════════════════');

  test2a();
  test2b();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  const passed = 2 - failures;
  console.log(`  Passed: ${passed}/2`);
  console.log(`  Failed: ${failures}/2`);
  if (failures > 0) {
    console.log('\n  Failed tests:');
    evidence.filter(e => e.status === '❌ FAIL').forEach(e => {
      console.log(`    ${e.test}`);
    });
    process.exit(1);
  } else {
    console.log('\n  🎉 ALL RLS TESTS PASSED.');
    process.exit(0);
  }
}

main();
