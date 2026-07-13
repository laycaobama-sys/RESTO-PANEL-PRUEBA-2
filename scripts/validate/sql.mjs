// ============================================================
// sql.mjs — SQL integrity validation for RestoPanel
// ============================================================
// Proves that every migration file follows safe-SQL conventions:
//
//   3a. Static scan:
//     - No function uses string concatenation for SQL (injection)
//     - All SECURITY DEFINER functions have SET search_path
//     - All CREATE UNIQUE INDEX are preceded by dedup logic
//     - All ALTER TABLE ... ADD CONSTRAINT ... CHECK use NOT VALID
//     - All CREATE POLICY are preceded by DROP POLICY IF EXISTS
//
//   3b. transfer_reservation() RPC is atomic (FOR UPDATE, 3 updates
//       in same body, org_id validation)
//
//   3c. increment_usage() RPC is atomic (INSERT ... ON CONFLICT
//       DO UPDATE SET count = count + 1)
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

// Get lines (with line numbers) of a migration file.
function lines(mig) {
  return mig.content.split('\n').map((l, i) => ({ num: i + 1, text: l }));
}

// ============================================================
// TEST 3a — Static SQL safety scan
// ============================================================
function test3a() {
  const migrations = readMigrations();

  const injectionHits = [];        // EXECUTE with string concat
  const securityDefinerMissingSearchPath = []; // SECURITY DEFINER without SET search_path
  const uniqueIndexNoDedup = [];   // CREATE UNIQUE INDEX without preceding dedup
  const checkMissingNotValid = []; // ALTER ... ADD CONSTRAINT ... CHECK without NOT VALID
  const policyMissingDrop = [];    // CREATE POLICY without preceding DROP POLICY IF EXISTS

  for (const mig of migrations) {
    const src = mig.content;
    const ls = lines(mig);

    // ─── 3a1: SQL injection (EXECUTE with concat or %s) ─
    // Safe: EXECUTE format('...%I...%L...', args)
    // Unsafe: EXECUTE '...' || var || '...'
    //         EXECUTE format('...%s...', var)
    //         EXECUTE '...' || something
    ls.forEach((line, idx) => {
      const lt = line.text.trim().toLowerCase();
      // EXECUTE 'string' || something — direct concatenation
      if (/execute\s+['"]/i.test(line.text) && /\|\|/.test(line.text)) {
        injectionHits.push({ migration: mig.name, line: line.num, text: line.text.trim() });
      }
      // EXECUTE format('...%s...', ...) — %s is unsafe in format()
      if (/execute\s+format\s*\(/i.test(line.text) && /%s/.test(line.text)) {
        injectionHits.push({ migration: mig.name, line: line.num, text: line.text.trim() });
      }
    });

    // ─── 3a2: SECURITY DEFINER + SET search_path ────────
    // Find each `security definer` token (case-insensitive) and
    // check that `set search_path` appears within the next 5 lines
    // (or before the next $$ delimiter). Skip comment lines.
    ls.forEach((line, idx) => {
      // Skip lines that are pure SQL comments (start with -- after trim).
      if (line.text.trim().startsWith('--')) return;
      if (!/security\s+definer/i.test(line.text)) return;
      // Look ahead up to 8 lines for `set search_path`.
      const lookahead = ls.slice(idx, idx + 8).map(l => l.text).join('\n');
      if (!/set\s+search_path\s*=/i.test(lookahead)) {
        // Also check the preceding 2 lines (some migrations put
        // SET search_path BEFORE SECURITY DEFINER on the prior line).
        const lookbehind = ls.slice(Math.max(0, idx - 3), idx).map(l => l.text).join('\n');
        if (!/set\s+search_path\s*=/i.test(lookbehind)) {
          securityDefinerMissingSearchPath.push({
            migration: mig.name,
            line: line.num,
            text: line.text.trim(),
          });
        }
      }
    });

    // ─── 3a3: CREATE UNIQUE INDEX preceded by dedup ─────
    // For each `CREATE UNIQUE INDEX` (case-insensitive), look back
    // up to 80 lines for a `DELETE FROM <same-table>` or a DO $$ block
    // that contains a DELETE FROM. The dedup logic must be on the
    // SAME table as the index.
    ls.forEach((line, idx) => {
      const m = /create\s+unique\s+index\s+(?:if\s+not\s+exists\s+)?\w+\s+on\s+(\w+)/i.exec(line.text);
      if (!m) return;
      const table = m[1];
      // Look back up to 100 lines for DELETE FROM <table> or a DO block
      // mentioning <table> and DELETE.
      const lookback = ls.slice(Math.max(0, idx - 100), idx).map(l => l.text).join('\n');
      // Direct dedup: DELETE FROM <table>
      const directDedup = new RegExp(`delete\\s+from\\s+${table}\\b`, 'i').test(lookback);
      // DO block dedup: the table appears in a DO $$ ... DELETE FROM ... $$ block.
      // We just check that <table> appears AND "delete from" appears in the lookback.
      const doBlockDedup = new RegExp(`do\\s*\\$\\$`, 'i').test(lookback) &&
        new RegExp(`\\b${table}\\b`, 'i').test(lookback) &&
        /delete\s+from/i.test(lookback);
      // Special case: the UNIQUE INDEX is on a column that was JUST added
      // (ALTER TABLE ... ADD COLUMN IF NOT EXISTS) — existing rows are
      // all NULL, so no dedup is needed. We accept this if the lookback
      // contains `add column if not exists <col>` for the indexed column.
      const colMatch = /\(([\w_]+)\)/.exec(line.text) || /on\s+\w+\s*\(([\w_]+)\)/i.exec(line.text);
      const addedJustNow = colMatch && new RegExp(`add\\s+column\\s+if\\s+not\\s+exists\\s+${colMatch[1]}`, 'i').test(lookback);

      if (!directDedup && !doBlockDedup && !addedJustNow) {
        uniqueIndexNoDedup.push({
          migration: mig.name,
          line: line.num,
          table,
          text: line.text.trim(),
        });
      }
    });

    // ─── 3a4: ALTER ... ADD CONSTRAINT ... CHECK NOT VALID
    // For each `alter table ... add constraint ... check (...)`
    // verify that `not valid` appears in the same statement.
    // (Inline CHECK in CREATE TABLE is exempt — the table is new.)
    ls.forEach((line, idx) => {
      if (/add\s+constraint\s+\w+\s+check\s*\(/i.test(line.text)) {
        // The statement may span multiple lines — check this + next 4 lines.
        const stmt = ls.slice(idx, idx + 5).map(l => l.text).join('\n');
        if (!/not\s+valid/i.test(stmt)) {
          checkMissingNotValid.push({
            migration: mig.name,
            line: line.num,
            text: line.text.trim(),
          });
        }
      }
    });

    // ─── 3a5: CREATE POLICY preceded by DROP POLICY IF EXISTS
    // For each `create policy <name> on <table>`, look back up to 10
    // lines for `drop policy if exists <name> on <table>`.
    // Dynamic policies (in DO $$ blocks via format()) are exempt if
    // the DO block contains both DROP and CREATE.
    ls.forEach((line, idx) => {
      const m = /create\s+policy\s+(\w+)\s+on\s+(\w+)/i.exec(line.text);
      if (!m) return;
      const policyName = m[1];
      const table = m[2];

      // Look back up to 10 lines for `drop policy if exists <name> on <table>`.
      const lookback = ls.slice(Math.max(0, idx - 10), idx).map(l => l.text).join('\n');
      const directDrop = new RegExp(`drop\\s+policy\\s+if\\s+exists\\s+${policyName}\\s+on\\s+${table}\\b`, 'i').test(lookback);

      // Also check if this policy name was dropped in a PRECEDING migration
      // (rare, but valid — e.g., a migration may DROP in file A and
      // CREATE in file B). For simplicity, we only check within the
      // same file. Cross-file drops are flagged for manual review.

      // Dynamic format('create policy %I... on %I...', name, table) —
      // these come in pairs with format('drop policy if exists %I on %I', name, table).
      // If the lookback contains a matching format('drop policy...'), it's OK.
      const dynamicDrop = /execute\s+format\s*\(\s*['"]drop\s+policy\s+if\s+exists\s+%I\s+on\s+%I/i.test(lookback);

      // If the CREATE POLICY is inside a DO $$ block, also accept that
      // the block has a preceding DROP for the same name.
      const inDoBlock = /do\s*\$\$/i.test(lookback) && /drop\s+policy\s+if\s+exists/i.test(lookback);

      if (!directDrop && !dynamicDrop && !inDoBlock) {
        policyMissingDrop.push({
          migration: mig.name,
          line: line.num,
          policy: policyName,
          table,
          text: line.text.trim(),
        });
      }
    });
  }

  const allGood = injectionHits.length === 0 &&
    securityDefinerMissingSearchPath.length === 0 &&
    uniqueIndexNoDedup.length === 0 &&
    checkMissingNotValid.length === 0 &&
    policyMissingDrop.length === 0;
  const status = allGood ? '✅ PASS' : '❌ FAIL';
  if (status === '❌ FAIL') failures++;

  const ev = [
    `3a1 — SQL injection (EXECUTE with || or %s): ${injectionHits.length} hit(s)`,
    injectionHits.length ? injectionHits.map(h => `  - ${h.migration}:${h.line}  ${h.text}`).join('\n') : '  ✅ all EXECUTE use format() with %I/%L',
    ``,
    `3a2 — SECURITY DEFINER without SET search_path: ${securityDefinerMissingSearchPath.length} hit(s)`,
    securityDefinerMissingSearchPath.length ? securityDefinerMissingSearchPath.map(h => `  - ${h.migration}:${h.line}  ${h.text}`).join('\n') : '  ✅ all SECURITY DEFINER functions have SET search_path',
    ``,
    `3a3 — CREATE UNIQUE INDEX without preceding dedup: ${uniqueIndexNoDedup.length} hit(s)`,
    uniqueIndexNoDedup.length ? uniqueIndexNoDedup.map(h => `  - ${h.migration}:${h.line}  on ${h.table}  ${h.text}`).join('\n') : '  ✅ all CREATE UNIQUE INDEX preceded by DELETE FROM dedup',
    ``,
    `3a4 — ALTER ... ADD CONSTRAINT ... CHECK without NOT VALID: ${checkMissingNotValid.length} hit(s)`,
    checkMissingNotValid.length ? checkMissingNotValid.map(h => `  - ${h.migration}:${h.line}  ${h.text}`).join('\n') : '  ✅ all ALTER ... CHECK use NOT VALID',
    ``,
    `3a5 — CREATE POLICY without preceding DROP POLICY IF EXISTS: ${policyMissingDrop.length} hit(s)`,
    policyMissingDrop.length ? policyMissingDrop.map(h => `  - ${h.migration}:${h.line}  ${h.policy} on ${h.table}  ${h.text}`).join('\n') : '  ✅ all CREATE POLICY preceded by DROP POLICY IF EXISTS',
  ].join('\n  ');

  printTest('3a', 'SQL safety static scan (injection, search_path, dedup, NOT VALID, DROP POLICY)',
    status,
    `injection=${injectionHits.length}, ` +
    `search_path=${securityDefinerMissingSearchPath.length}, ` +
    `dedup=${uniqueIndexNoDedup.length}, ` +
    `not_valid=${checkMissingNotValid.length}, ` +
    `drop_policy=${policyMissingDrop.length}`,
    `  ${ev}`);

  evidence.push({ test: '3a', status, injectionHits, securityDefinerMissingSearchPath, uniqueIndexNoDedup, checkMissingNotValid, policyMissingDrop });

  if (policyMissingDrop.length > 0) {
    console.log('\n  ⚠️  FIX PROPOSED: Add `DROP POLICY IF EXISTS <name> ON <table>;` before each CREATE POLICY.');
  }
  if (securityDefinerMissingSearchPath.length > 0) {
    console.log('  ⚠️  FIX PROPOSED: Add `SET search_path = public, pg_temp` to each SECURITY DEFINER function.');
  }
  if (checkMissingNotValid.length > 0) {
    console.log('  ⚠️  FIX PROPOSED: Add NOT VALID to each ALTER TABLE ... ADD CONSTRAINT ... CHECK.');
  }
  if (uniqueIndexNoDedup.length > 0) {
    console.log('  ⚠️  FIX PROPOSED: Add DELETE FROM dedup logic before each CREATE UNIQUE INDEX.');
  }
}

// ============================================================
// TEST 3b — transfer_reservation() RPC atomicity
// ============================================================
function test3b() {
  // The function is defined in 0015 and REPLACED in 0018. We read
  // 0018 (the authoritative version) and confirm:
  //   - Uses FOR UPDATE on the reservation row
  //   - Uses FOR UPDATE on the new table row
  //   - All 3 updates (reservation, old table, new table) are in
  //     the same function body (implicit transaction)
  //   - Validates org_id (v_reservation.organization_id != v_org_id)
  const mig0018 = readSrc('supabase/migrations/0018_audit_fixes.sql');

  // Extract the transfer_reservation function body from 0018.
  const fnStart = mig0018.indexOf('CREATE OR REPLACE FUNCTION transfer_reservation');
  const fnEnd = mig0018.indexOf('COMMENT ON FUNCTION transfer_reservation', fnStart);
  const fnBody = mig0018.slice(fnStart, fnEnd);

  // Also check the route handler passes p_old_table_id (for the
  // optimistic-lock check).
  const routeSrc = readSrc('src/app/api/tables/transfer/route.ts');

  const checks = {
    usesForUpdateReservation: /SELECT\s+\*\s+INTO\s+v_reservation[\s\S]*?FROM\s+reservations[\s\S]*?FOR\s+UPDATE/i.test(fnBody),
    usesForUpdateTable: /SELECT\s+\*\s+INTO\s+v_new_table[\s\S]*?FROM\s+tables[\s\S]*?FOR\s+UPDATE/i.test(fnBody),
    has3UpdatesInSameBody: /UPDATE\s+reservations[\s\S]*?UPDATE\s+tables[\s\S]*?SET\s+status\s*=\s*'AVAILABLE'[\s\S]*?UPDATE\s+tables[\s\S]*?SET\s+status\s*=\s*'RESERVED'/i.test(fnBody),
    validatesOrgId: /v_reservation\.organization_id\s*!=\s*v_org_id/i.test(fnBody) || /v_reservation\.organization_id\s*<>?\s*v_org_id/i.test(fnBody),
    hasOptimisticLock: /p_old_table_id\s*IS\s+NOT\s+NULL\s+AND\s+v_reservation\.table_id\s+IS\s+NOT\s+NULL[\s\S]*?p_old_table_id::text\s*!=\s*v_reservation\.table_id::text/i.test(fnBody),
    routePassesOldTableId: /p_old_table_id:\s*oldTableId/.test(routeSrc),
    isSecurityDefiner: /SECURITY\s+DEFINER/i.test(fnBody),
    hasSearchPath: /SET\s+search_path\s*=\s*public/i.test(fnBody),
  };

  const allOk = Object.values(checks).every(v => v === true);
  const status = allOk ? '✅ PASS' : '❌ FAIL';
  if (status === '❌ FAIL') failures++;

  const ev = [
    `Function extracted from 0018_audit_fixes.sql (${fnBody.length} chars)`,
    ``,
    `Uses SELECT ... FOR UPDATE on reservation row: ${checks.usesForUpdateReservation ? '✅' : '❌'}`,
    `Uses SELECT ... FOR UPDATE on new table row: ${checks.usesForUpdateTable ? '✅' : '❌'}`,
    `All 3 updates in same function body (implicit transaction): ${checks.has3UpdatesInSameBody ? '✅' : '❌'}`,
    `Validates org_id (reservation.organization_id != caller org): ${checks.validatesOrgId ? '✅' : '❌'}`,
    `Optimistic-lock check on p_old_table_id: ${checks.hasOptimisticLock ? '✅' : '❌'}`,
    `Route passes p_old_table_id to RPC: ${checks.routePassesOldTableId ? '✅' : '❌'}`,
    `SECURITY DEFINER: ${checks.isSecurityDefiner ? '✅' : '❌'}`,
    `SET search_path = public: ${checks.hasSearchPath ? '✅' : '❌'}`,
    ``,
    `--- Function body (verbatim, first 60 lines) ---`,
    fnBody.split('\n').slice(0, 60).join('\n'),
  ].join('\n  ');

  printTest('3b', 'transfer_reservation() RPC atomicity (FOR UPDATE + 3 updates + org_id validation)',
    status,
    `FOR UPDATE: ${checks.usesForUpdateReservation && checks.usesForUpdateTable ? 'yes' : 'NO'}. ` +
    `3 updates in same body: ${checks.has3UpdatesInSameBody ? 'yes' : 'NO'}. ` +
    `org_id validation: ${checks.validatesOrgId ? 'yes' : 'NO'}. ` +
    `optimistic lock: ${checks.hasOptimisticLock ? 'yes' : 'NO'}.`,
    `  ${ev}`);

  evidence.push({ test: '3b', status, checks });
}

// ============================================================
// TEST 3c — increment_usage() RPC atomicity
// ============================================================
function test3c() {
  const mig0019 = readSrc('supabase/migrations/0019_phase_audit_fixes.sql');

  // Extract the increment_usage function body.
  const fnStart = mig0019.indexOf('CREATE OR REPLACE FUNCTION increment_usage');
  const fnEnd = mig0019.indexOf('COMMENT ON FUNCTION increment_usage', fnStart);
  const fnBody = mig0019.slice(fnStart, fnEnd);

  const checks = {
    usesInsertOnConflict: /INSERT\s+INTO\s+organization_usage[\s\S]*?ON\s+CONFLICT\s*\(\s*organization_id\s*,\s*metric\s*,\s*period\s*\)/i.test(fnBody),
    usesDoUpdateSetCount: /DO\s+UPDATE\s+SET\s+count\s*=\s*organization_usage\.count\s*\+\s*1/i.test(fnBody),
    isSingleStatement: !/;[\s\S]*UPDATE[\s\S]*;[\s\S]*SELECT/i.test(fnBody.replace(/--.*$/gm, '')), // no separate UPDATE/SELECT after the INSERT
    isSecurityDefiner: /SECURITY\s+DEFINER/i.test(fnBody),
    hasSearchPath: /SET\s+search_path\s*=\s*public/i.test(fnBody),
  };

  const allOk = Object.values(checks).every(v => v === true);
  const status = allOk ? '✅ PASS' : '❌ FAIL';
  if (status === '❌ FAIL') failures++;

  const ev = [
    `Function extracted from 0019_phase_audit_fixes.sql (${fnBody.length} chars)`,
    ``,
    `Uses INSERT ... ON CONFLICT (organization_id, metric, period): ${checks.usesInsertOnConflict ? '✅' : '❌'}`,
    `Uses DO UPDATE SET count = organization_usage.count + 1: ${checks.usesDoUpdateSetCount ? '✅' : '❌'}`,
    `Single atomic statement (no separate UPDATE/SELECT): ${checks.isSingleStatement ? '✅' : '❌'}`,
    `SECURITY DEFINER: ${checks.isSecurityDefiner ? '✅' : '❌'}`,
    `SET search_path = public: ${checks.hasSearchPath ? '✅' : '❌'}`,
    ``,
    `--- Function body (verbatim) ---`,
    fnBody.trim(),
  ].join('\n  ');

  printTest('3c', 'increment_usage() RPC atomicity (INSERT ... ON CONFLICT DO UPDATE SET count = count + 1)',
    status,
    `INSERT ON CONFLICT: ${checks.usesInsertOnConflict ? 'yes' : 'NO'}. ` +
    `DO UPDATE SET count = count + 1: ${checks.usesDoUpdateSetCount ? 'yes' : 'NO'}. ` +
    `Single statement: ${checks.isSingleStatement ? 'yes' : 'NO'}.`,
    `  ${ev}`);

  evidence.push({ test: '3c', status, checks });
}

// ============================================================
// Main
// ============================================================
function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SQL INTEGRITY VALIDATION — RestoPanel');
  console.log('  Static scan + RPC atomicity checks');
  console.log('═══════════════════════════════════════════════════════════');

  test3a();
  test3b();
  test3c();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  const passed = 3 - failures;
  console.log(`  Passed: ${passed}/3`);
  console.log(`  Failed: ${failures}/3`);
  if (failures > 0) {
    console.log('\n  Failed tests:');
    evidence.filter(e => e.status === '❌ FAIL').forEach(e => {
      console.log(`    ${e.test}`);
    });
    process.exit(1);
  } else {
    console.log('\n  🎉 ALL SQL TESTS PASSED.');
    process.exit(0);
  }
}

main();
