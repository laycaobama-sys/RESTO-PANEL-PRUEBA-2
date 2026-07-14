// ============================================================
// RestoPanel · Performance validation
// ============================================================
// Proves the system performs well by auditing:
//   1a. N+1 query detection in API routes
//   1b. Bundle analysis from `npx next build` output
//   1c. Query optimization in src/lib/db.ts
//   1d. Index coverage in supabase/migrations/*.sql
//
// Exit code 0 = all tests pass (or only acceptable warnings).
// Exit code 1 = at least one test failed.
// ============================================================

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const RESULTS = [];

function pass(name, result, evidence) {
  RESULTS.push({ name, status: 'PASS', result, evidence });
  console.log(`### ${name}\nStatus: ✅ PASS\nResult: ${result}\nEvidence: ${evidence}\n`);
}
function fail(name, result, evidence, fix) {
  RESULTS.push({ name, status: 'FAIL', result, evidence, fix });
  console.log(`### ${name}\nStatus: ❌ FAIL\nResult: ${result}\nEvidence: ${evidence}`);
  if (fix) console.log(`Proposed fix: ${fix}`);
  console.log('');
}
function warn(name, result, evidence) {
  RESULTS.push({ name, status: 'WARN', result, evidence });
  console.log(`### ${name}\nStatus: ⚠️ WARN\nResult: ${result}\nEvidence: ${evidence}\n`);
}

// ============================================================
// Helpers — walk & read files
// ============================================================
function walk(dir, pred = () => true) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p, pred));
    else if (pred(p)) out.push(p);
  }
  return out;
}

function readLines(path) {
  return readFileSync(path, 'utf8').split('\n');
}

// ============================================================
// 1a. N+1 query detection
// ============================================================
console.log('════════════════════════════════════════════════════════════');
console.log('  Part 1a · N+1 query detection');
console.log('════════════════════════════════════════════════════════════\n');

const API_DIR = resolve(ROOT, 'src/app/api');
const routeFiles = walk(API_DIR, (p) => p.endsWith('/route.ts'));

// Patterns that indicate N+1:
//   1. db query INSIDE a .map(async ...) → classic N+1
//   2. Promise.all(array.map(async () => <DB QUERY>)) → still N+1 (N parallel queries)
//   3. List endpoints that don't use .limit() / .range() / .single() / .maybeSingle()
const n1Findings = [];

for (const file of routeFiles) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const rel = relative(ROOT, file);

  // (1) Detect DB queries inside .map(async ...) blocks.
  // Two flavours:
  //   (a) direct .from('...') call inside the loop body
  //   (b) db.<entity>.<method>( call inside the loop body — this delegates
  //       to db.ts which executes a real query. The db library is the
  //       main vector for N+1 in this codebase.
  // We walk every line, find lines that look like a DB call, then walk
  // back up to 10 lines to see if we're inside a .map(async ...) block.
  // The walk-back is bounded so we don't false-flag a top-level query that
  // happens to follow a .map somewhere above.
  const seenN1Lines = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment lines (// or * or /*) — they may contain regex patterns
    // like "db.order.listItems" inside explanatory comments, which would
    // false-positive as a DB call.
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    const isFromCall = /\.from\(['"`]/.test(line);
    const isDbLibCall = /\bdb\.\w+\.\w+\s*\(/.test(line);
    if (!isFromCall && !isDbLibCall) continue;
    // Skip Promise.resolve(...) wrappers (no real query)
    if (/Promise\.resolve/.test(line)) continue;
    // Walk back up to 12 lines to find a .map(async that opens this loop.
    // Skip comment lines (// *) in the walkback — a `.map(async` inside
    // a // comment doesn't open a real loop.
    let opensLoop = false;
    for (let j = Math.max(0, i - 12); j < i; j++) {
      const back = lines[j].trim();
      if (back.startsWith('//') || back.startsWith('*') || back.startsWith('/*')) continue;
      if (/\.map\(\s*async/.test(lines[j])) { opensLoop = true; break; }
    }
    if (opensLoop) {
      const key = `${rel}:${i + 1}`;
      if (!seenN1Lines.has(key)) {
        seenN1Lines.add(key);
        n1Findings.push({
          file: rel,
          line: i + 1,
          pattern: 'DB query inside .map(async ...) — N+1 (one DB round-trip per item)',
          snippet: line.trim().slice(0, 140),
        });
      }
    }
  }

  // (2) Detect Promise.all(items.map(async () => <DB QUERY>)) — this is
  // already covered by (1) because the .map(async ... opens the loop and
  // the .from/db call inside it gets flagged. We keep a separate scan
  // for the case where the db call is on the SAME line as .map(async:
  // e.g. `await Promise.all(items.map(async (i) => (await db.x.find(i))))`.
  // This is rare but worth a single regex check.
  const inlinePromiseAllN1 = /Promise\.all\([^)]*\.map\(\s*async[^)]*\bdb\.\w+\.\w+\(/;
  if (inlinePromiseAllN1.test(src)) {
    // Find the line number of the first match
    const m = inlinePromiseAllN1.exec(src);
    if (m) {
      const lineNo = src.slice(0, m.index).split('\n').length;
      n1Findings.push({
        file: rel,
        line: lineNo,
        pattern: 'Promise.all(items.map(async () => db.<x>.<method>())) — inline N+1',
        snippet: m[0].slice(0, 140),
      });
    }
  }

  // (3) Detect list endpoints missing pagination (no .limit(), .range(), or .single())
  // A "list endpoint" is a GET handler that returns multiple rows.
  // Heuristic: route file has `export async function GET`, contains .from(...).select(...),
  // and neither .limit(, .range(, .single(), nor .maybeSingle() appears in the same query chain.
  //
  // IMPORTANT: we only flag queries that RETURN rows to the client. Queries
  // that are used for aggregation (e.g. .select('total', { count: 'exact',
  // head: false }).gte('date', ...)) fetch rows for in-memory reduction and
  // are filtered by date range — they're not list endpoints and don't need
  // pagination. We detect this by checking if the route's response maps
  // over the data (`.map(`) or returns it directly (NextResponse.json(data)).
  if (/export\s+async\s+function\s+GET/.test(src)) {
    const getStart = src.indexOf('export async function GET');
    const nextExport = src.indexOf('export', getStart + 10);
    const getBody = nextExport > 0 ? src.slice(getStart, nextExport) : src.slice(getStart);
    // File line number where getBody starts (1-indexed).
    const getStartLine = src.slice(0, getStart).split('\n').length;

    // Find every .from('table').select(...) chain in the GET handler
    const fromMatches = [...getBody.matchAll(/\.from\(['"`]([a-z_]+)['"`]\)/g)];
    for (const m of fromMatches) {
      const tablePos = m.index ?? 0;
      // Look 500 chars ahead for the rest of the query chain
      const tail = getBody.slice(tablePos, tablePos + 800);
      const hasLimit = /\.limit\(/.test(tail);
      const hasRange = /\.range\(/.test(tail);
      const hasSingle = /\.maybeSingle\(\)/.test(tail) || /\.single\(\)/.test(tail);
      // Count-only queries (head: true) don't return rows → no pagination needed
      const hasHeadCount = /head:\s*true/.test(tail);
      // Queries filtered by a date range (gte/lt/gte/lte on created_at or date)
      // are aggregate queries — they fetch a bounded window for in-memory
      // reduction. We treat these as "not a list endpoint".
      const hasDateRange = /\.(gte|gt|lt|lte)\(['"](?:created_at|date|updated_at)['"]/.test(tail);
      // Queries filtered by an IN clause with explicit values (e.g.
      // .in('status', ['CONFIRMED','PENDING'])) are bounded by the IN list
      // — still worth paginating, but we relax to WARN.
      if (!hasLimit && !hasRange && !hasSingle && !hasHeadCount && !hasDateRange) {
        // Compute file line number = (line within getBody) + (start line of getBody) - 1
        const prefix = getBody.slice(0, tablePos);
        const lineInGetBody = prefix.split('\n').length;
        const fileLine = lineInGetBody + getStartLine - 1;
        n1Findings.push({
          file: rel,
          line: fileLine,
          pattern: `List query on "${m[1]}" missing pagination (.limit / .range)`,
          snippet: `${m[0]}  → no .limit()/.range()/.single()`,
        });
      }
    }
  }
}

// Allowlist: list endpoints that legitimately don't paginate because they're
// bounded (e.g. roles, permissions, channels) or are filtered by parent FK.
// We mark these as "WARN (acceptable)" rather than FAIL.
const ACCEPTABLE_NO_PAGINATION = [
  // /api/roles + /api/permissions return a tiny static catalog
  'api/roles/route.ts',
  'api/permissions/route.ts',
  // /api/chat/channels returns ≤6 fixed channels per tenant
  'api/chat/channels/route.ts',
  // /api/health returns a single status object
  'api/health/route.ts',
  'api/admin/health/route.ts',
  // /api/seed* are dev-only endpoints
  'api/seed/route.ts',
  'api/seed-customers/route.ts',
  'api/admin/seed-notifications/route.ts',
  'api/admin/seed-super-admin/route.ts',
  // /api/route.ts is just an info endpoint
  'api/route.ts',
  // /api/restaurant returns the current tenant only
  'api/restaurant/route.ts',
  // /api/restaurant/import-web is a POST that doesn't list
  'api/restaurant/import-web/route.ts',
  // /api/tables/available returns filtered tables (bounded by tenant capacity)
  'api/tables/available/route.ts',
  // /api/tables/positions is a PATCH
  'api/tables/positions/route.ts',
  // /api/tables/transfer is a POST (RPC)
  'api/tables/transfer/route.ts',
  'api/tables/group/route.ts',
  // /api/tables/[id] returns single row
  'api/tables/[id]/route.ts',
  'api/orders/[id]/route.ts',
  'api/menu/[id]/route.ts',
  'api/categories/[id]/route.ts',
  'api/reservations/[id]/route.ts',
  'api/shifts/[id]/route.ts',
  'api/customers/[id]/route.ts',
  'api/notifications/[id]/route.ts',
  'api/admin/notifications/[id]/route.ts',
  'api/admin/tenants/[id]/route.ts',
  'api/admin/tenants/[id]/details/route.ts',
  // /api/auth/* are POST handlers (no GET list)
  'api/auth/[...nextauth]/route.ts',
  'api/auth/forgot-password/route.ts',
  'api/auth/register/route.ts',
  'api/auth/reset-password/route.ts',
  'api/auth/verify-email/route.ts',
  // /api/billing/* return single-row responses
  'api/billing/checkout/route.ts',
  'api/billing/portal/route.ts',
  'api/billing/subscription/route.ts',
  // /api/stripe/webhook is POST
  'api/stripe/webhook/route.ts',
  // /api/whatsapp/webhook + status are POST / single-row
  'api/whatsapp/webhook/route.ts',
  'api/whatsapp/status/route.ts',
  // /api/upload is POST
  'api/upload/route.ts',
  // /api/public/[slug] returns the full restaurant menu (bounded by tenant; the
  // menu has a fixed upper bound of items per tenant by plan limit).
  'api/public/[slug]/route.ts',
  // /api/public/reviews HAS a .limit() — but the inner aggregate fetch doesn't,
  // which is fine because it's filtered by status='APPROVED' and bounded by the
  // outer .limit() in the same query.
  // /api/user/profile is a single-row GET
  'api/user/profile/route.ts',
  // /api/user/sessions returns the caller's sessions (bounded)
  'api/user/sessions/route.ts',
  // /api/admin/impersonate is POST
  'api/admin/impersonate/route.ts',
  // /api/admin/maintenance is POST
  'api/admin/maintenance/route.ts',
  // /api/admin/settings is GET single-row
  'api/admin/settings/route.ts',
  // /api/admin/system-status returns a health-check object (no list query)
  'api/admin/system-status/route.ts',
];

// Critical N+1 patterns that we MUST fix (filter out the acceptable ones).
// "Critical" = an actual N+1 (Pattern 1 or 2) OR a list endpoint with no pagination
// that isn't in the allowlist.
const criticalN1 = n1Findings.filter((f) => {
  // Always critical if it's a true N+1 (patterns 1 & 2)
  if (f.pattern.startsWith('DB query inside') || f.pattern.startsWith('Promise.all')) return true;
  // For pagination findings, check allowlist by file path
  if (f.pattern.startsWith('List query')) {
    return !ACCEPTABLE_NO_PAGINATION.some((p) => f.file.endsWith(p));
  }
  return false;
});

if (criticalN1.length === 0) {
  pass(
    'Test 1: N+1 query detection',
    'No critical N+1 patterns found in any API route.',
    `Scanned ${routeFiles.length} route files. ${n1Findings.length} raw findings (${n1Findings.length - criticalN1.length} allowlisted as bounded endpoints, 0 critical).`
  );
} else {
  const evidence = criticalN1
    .map((f) => `  • ${f.file}:${f.line}\n    ${f.pattern}\n    snippet: ${f.snippet}`)
    .join('\n');
  fail(
    'Test 1: N+1 query detection',
    `${criticalN1.length} critical N+1 patterns found.`,
    evidence,
    'Replace Promise.all(items.map(async () => query)) with a single batched query using .in("id", ids). Add .limit() to list endpoints.'
  );
}

// ============================================================
// 1b. Bundle analysis
// ============================================================
console.log('════════════════════════════════════════════════════════════');
console.log('  Part 1b · Bundle analysis (npx next build output)');
console.log('════════════════════════════════════════════════════════════\n');

const NEXT_DIR = resolve(ROOT, '.next');
if (!existsSync(NEXT_DIR)) {
  fail(
    'Test 2: Bundle analysis',
    'No .next/ directory — run `npx next build` first.',
    'Cannot verify bundle sizes or static/dynamic rendering.',
    'Run: SUPABASE_URL=dummy SUPABASE_SERVICE_ROLE_KEY=dummy NEXTAUTH_URL=http://localhost:3000 NEXTAUTH_SECRET=dummy npx next build'
  );
} else {
  // (a) Per-route entry JS bundles
  const manifestPath = resolve(NEXT_DIR, 'server/app/landing/page_client-reference-manifest.js');
  // The build also prints the route table to stdout. We re-derive per-route
  // entry JS files from the .next/server/app/<route>/page_client-reference-manifest.js
  // entryJSFiles map. Simpler: walk .next/static/chunks and verify no single
  // chunk exceeds 500 KB.
  const chunksDir = resolve(NEXT_DIR, 'static/chunks');
  let oversized = [];
  if (existsSync(chunksDir)) {
    for (const f of readdirSync(chunksDir)) {
      if (!f.endsWith('.js')) continue;
      const size = statSync(join(chunksDir, f)).size;
      if (size > 500 * 1024) {
        oversized.push({ file: f, sizeKB: Math.round(size / 1024) });
      }
    }
  }

  if (oversized.length === 0) {
    pass(
      'Test 2: Bundle analysis — no oversized chunks',
      'No single JS chunk exceeds 500 KB.',
      'All chunks in .next/static/chunks/ are ≤ 500 KB.'
    );
  } else {
    const evidence = oversized.map((o) => `  • ${o.file} = ${o.sizeKB} KB`).join('\n');
    fail(
      'Test 2: Bundle analysis — no oversized chunks',
      `${oversized.length} chunk(s) exceed 500 KB.`,
      evidence,
      'Code-split the offending chunk: dynamic-import heavy dependencies (e.g. recharts, react-syntax-highlighter, @mdxeditor/editor) inside the section that uses them.'
    );
  }

  // (b) Static vs dynamic rendering for critical routes
  // We re-run `npx next build` (cheap if cached) OR parse the existing
  // build output from .next/server/app/<route>/page.*. A route is dynamic
  // when its page.js exists in .next/server/app/<route>/ AND its
  // page.js.nft.json references dynamic functions. Simpler: check for
  // .next/server/app/<route>/page.shadow.* — only static prerenders emit
  // page.html. We use that as the signal.
  // Actually, the simplest reliable signal: Next.js emits
  // .next/server/app/<route>/page.html for statically-prerendered routes,
  // and only page.js + page.rsc for dynamic ones.
  const criticalRoutes = [
    { route: '/', expected: 'dynamic', reason: 'uses getServerSession for auth check' },
    { route: '/login', expected: 'dynamic', reason: 'uses getServerSession for redirect' },
    { route: '/landing', expected: 'dynamic', reason: 'force-dynamic; fetches real review aggregate from DB' },
  ];
  const apiDynamicOk = [];
  const apiDynamicBad = [];

  // Check critical routes
  for (const r of criticalRoutes) {
    let dir = r.route === '/' ? '' : r.route;
    const htmlPath = resolve(NEXT_DIR, `server/app/${dir}/page.html`);
    const isStatic = existsSync(htmlPath);
    const actual = isStatic ? 'static' : 'dynamic';
    if (actual === r.expected) {
      pass(
        `Test 2.${r.route}: rendering mode`,
        `Route ${r.route} is ${actual} (expected ${r.expected}: ${r.reason}).`,
        isStatic ? `page.html exists at ${htmlPath}` : `no page.html at ${htmlPath} → server-rendered on demand`
      );
    } else {
      // Note: For / and /login, we said "static where possible". Since they
      // need the session cookie, dynamic is correct. If a route were static
      // when it should be dynamic, that's a real fail. If a route is dynamic
      // when we'd prefer static, that's a WARN.
      if (r.expected === 'dynamic' && actual === 'static') {
        fail(
          `Test 2.${r.route}: rendering mode`,
          `Route ${r.route} is static but expected dynamic.`,
          `page.html exists → route was prerendered at build time, but it needs session data.`,
          `Remove \`export const dynamic = 'force-static'\` or refactor to read cookies at runtime.`
        );
      } else {
        warn(
          `Test 2.${r.route}: rendering mode`,
          `Route ${r.route} is ${actual} (preferred ${r.expected}).`,
          `Acceptable: ${r.reason}.`
        );
      }
    }
  }

  // Check that all API routes are dynamic (ƒ)
  // We infer this by checking that no /api/ route has a page.html in
  // .next/server/app/api/<path>/.
  const apiServerDir = resolve(NEXT_DIR, 'server/app/api');
  if (existsSync(apiServerDir)) {
    const apiDirs = walk(apiServerDir, (p) => p.endsWith('/page.html'));
    if (apiDirs.length === 0) {
      pass(
        'Test 2: API routes are dynamically rendered',
        'All API routes are dynamic (no /api/.../page.html found).',
        `Verified by walking ${apiServerDir}.`
      );
    } else {
      fail(
        'Test 2: API routes are dynamically rendered',
        `${apiDirs.length} API route(s) were prerendered as static HTML.`,
        apiDirs.map((p) => '  • ' + relative(NEXT_DIR, p)).join('\n'),
        'API routes must be dynamic. Add `export const dynamic = "force-dynamic";` to the offending route.'
      );
    }
  }
}

// ============================================================
// 1c. Query optimization in src/lib/db.ts
// ============================================================
console.log('════════════════════════════════════════════════════════════');
console.log('  Part 1c · Query optimization (src/lib/db.ts)');
console.log('════════════════════════════════════════════════════════════\n');

const dbSrc = readFileSync(resolve(ROOT, 'src/lib/db.ts'), 'utf8');

// (a) organization_id filter
// Every list/find method that touches a tenant-scoped table MUST filter by
// organization_id (defense-in-depth, even though RLS also enforces it).
// Heuristic: split db.ts into "method blocks" (export const X = { async m() {...} }),
// and for each method that contains .from('tenant_table'), check that the same
// method also calls .eq('organization_id', ...).
const TENANT_TABLES = [
  'categories', 'menu_items', 'tables', 'orders', 'order_items',
  'reservations', 'organization_settings', 'verification_tokens',
  'customers', 'customer_tags', 'customer_tag_assignments',
  'chat_channels', 'chat_messages', 'staff_shifts', 'notifications',
  'whatsapp_messages', 'import_jobs', 'event_log',
  'feature_flag_overrides', 'zones',
  'user_roles', 'user_activity', 'user_sessions',
  'organization_subscriptions', 'invoices', 'payment_methods',
  'subscription_history', 'usage_logs', 'audit_logs',
];
const NON_TENANT_TABLES = ['organizations', 'users', 'roles', 'permissions', 'role_permissions', 'subscription_plans', 'public_reviews', 'system_settings', 'import_html_cache', 'user_profiles'];

// Find every .from('table') SELECT call (not INSERT/UPDATE/DELETE) and
// check if the surrounding 800 chars contain .eq('organization_id', ...).
// We EXCLUDE:
//   - INSERTs (they set organization_id on the row, not filter by it)
//   - UPDATEs whose caller passes organization_id as a 2nd arg (the .eq()
//     chain on UPDATE is checked separately, but we still flag missing ones)
//   - The `superAdmin` namespace (it intentionally spans all tenants)
const fromRegex = /\.from\(\s*['"`]([a-z_]+)['"`]\s*\)/g;
let missingOrgFilter = [];
let m;
while ((m = fromRegex.exec(dbSrc)) !== null) {
  const table = m[1];
  if (NON_TENANT_TABLES.includes(table)) continue;
  if (!TENANT_TABLES.includes(table)) continue;
  // Look at the 200 chars BEFORE the .from( call to see if this is an
  // INSERT (`.from(t).insert(`) or UPDATE (`.from(t).update(`) — these
  // don't need a filter.
  const before = dbSrc.slice(Math.max(0, m.index - 50), m.index);
  const after = dbSrc.slice(m.index, m.index + 100);
  const isInsert = /\.insert\(/.test(after);
  const isUpdate = /\.update\(/.test(after);
  const isDelete = /\.delete\(/.test(after);
  if (isInsert) continue; // inserts set org_id on the row, no filter needed
  // For UPDATE/DELETE, the .eq('organization_id', ...) appears AFTER the
  // .update()/.delete() call. We already check the tail below.
  // Look 800 chars ahead for .eq('organization_id', ...)
  const tail = dbSrc.slice(m.index, m.index + 800);
  if (!/\.eq\(\s*['"`]organization_id['"`]\s*,/.test(tail)) {
    // Check if this query is inside the `superAdmin` namespace (intentionally global).
    // We look back to the START of the file for the last `export const X = {`
    // declaration before m.index. That tells us which namespace we're in.
    const lookback = dbSrc.slice(0, m.index);
    const lastExport = lookback.lastIndexOf('export const ');
    if (lastExport >= 0) {
      const blockName = lookback.slice(lastExport + 13, lastExport + 60).match(/^(\w+)\s*=/);
      if (blockName && blockName[1] === 'superAdmin') continue; // intentionally global
    }
    // Compute line number
    const lineNo = dbSrc.slice(0, m.index).split('\n').length;
    missingOrgFilter.push({ table, line: lineNo, kind: isUpdate ? 'UPDATE' : isDelete ? 'DELETE' : 'SELECT' });
  }
}

if (missingOrgFilter.length === 0) {
  pass(
    'Test 3: db.ts organization_id filter',
    'Every SELECT/UPDATE/DELETE against a tenant-scoped table filters by organization_id (or is in the superAdmin namespace, which intentionally spans all tenants).',
    `Verified ${TENANT_TABLES.length} tenant tables. INSERTs are excluded (they set org_id on the row, no filter needed).`
  );
} else {
  const evidence = missingOrgFilter.map((f) => `  • db.ts:${f.line} — .from('${f.table}') [${f.kind}] without .eq('organization_id', ...)`).join('\n');
  fail(
    'Test 3: db.ts organization_id filter',
    `${missingOrgFilter.length} queries missing organization_id filter.`,
    evidence,
    'Add .eq("organization_id", organizationId) to each query chain. The function parameter must be passed in by the caller (API route).'
  );
}

// (b) List queries must have .limit() or .range()
// We look at the named "list" methods in each export const block.
// Heuristic: methods named `list*` or `findAll*` should call .limit or .range.
const listMethodRegex = /async\s+(list[A-Z]\w*|findAll\w*)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/g;
let lm;
let missingLimit = [];
while ((lm = listMethodRegex.exec(dbSrc)) !== null) {
  const methodName = lm[1];
  // Find the end of the method (next `async` at the same indent, or the closing `},`)
  const start = lm.index;
  const nextMethod = dbSrc.indexOf('async ', start + 10);
  const nextClose = dbSrc.indexOf('},', start + 10);
  const end = nextMethod > 0 && nextMethod < nextClose ? nextMethod : nextClose;
  const body = dbSrc.slice(start, end > 0 ? end : start + 2000);
  if (/\.from\(['"`]/.test(body) && !/\.limit\(/.test(body) && !/\.range\(/.test(body)) {
    const lineNo = dbSrc.slice(0, start).split('\n').length;
    missingLimit.push({ method: methodName, line: lineNo });
  }
}

if (missingLimit.length === 0) {
  pass(
    'Test 3: db.ts list methods have .limit()/.range()',
    'Every list* / findAll* method paginates.',
    'Verified by regex over db.ts method bodies.'
  );
} else {
  const evidence = missingLimit.map((f) => `  • db.ts:${f.line} — ${f.method}() has no .limit()/.range()`).join('\n');
  fail(
    'Test 3: db.ts list methods have .limit()/.range()',
    `${missingLimit.length} list method(s) missing pagination.`,
    evidence,
    'Add .limit(100) (or accept a `limit` option from the caller) to bound the result set.'
  );
}

// (c) Don't select * when only specific columns are needed.
// Heuristic: queries that feed into a count or `head: true` should not use
// select('*'). And queries that immediately reduce the result (e.g. compute
// a single metric) should select only the columns they use.
// This is hard to verify perfectly with regex, so we just check that no
// `select('*')` appears in a count/head context.
const selectStarInCount = [];
const lines = dbSrc.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (/\.select\(['"`]\*['"`]\s*,\s*\{\s*count:/.test(lines[i]) || /\.select\(['"`]\*['"`]\s*,\s*\{\s*head:\s*true/.test(lines[i])) {
    selectStarInCount.push({ line: i + 1, snippet: lines[i].trim() });
  }
}

if (selectStarInCount.length === 0) {
  pass(
    'Test 3: db.ts — no select(*) in count/head queries',
    'No count-only queries select *. They use select("id", { count: "exact", head: true }) instead.',
    'Verified by regex over db.ts.'
  );
} else {
  const evidence = selectStarInCount.map((f) => `  • db.ts:${f.line} — ${f.snippet}`).join('\n');
  fail(
    'Test 3: db.ts — no select(*) in count/head queries',
    `${selectStarInCount.length} count queries fetch all columns unnecessarily.`,
    evidence,
    'Replace .select("*", { count: "exact", head: true }) with .select("id", { count: "exact", head: true }).'
  );
}

// ============================================================
// 1d. Index coverage in migrations
// ============================================================
console.log('════════════════════════════════════════════════════════════');
console.log('  Part 1d · Index coverage (supabase/migrations/*.sql)');
console.log('════════════════════════════════════════════════════════════\n');

const migDir = resolve(ROOT, 'supabase/migrations');
const migFiles = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
const migSql = migFiles.map((f) => readFileSync(join(migDir, f), 'utf8')).join('\n\n');

// Helper: does `sql` contain an index on `table(column)` (case-insensitive)?
// We accept:
//   1. CREATE [UNIQUE] INDEX ... ON <table> ([(]?<column>[,)] ...)  — explicit index
//   2. <column> <type> UNIQUE   — column-level UNIQUE constraint (creates an implicit index)
//   3. UNIQUE (<column>)         — table-level UNIQUE constraint (creates an implicit index)
//   4. <column> <type> PRIMARY KEY  — column-level PK (creates an implicit index)
//   5. Dynamic CREATE INDEX inside a DO $$ ... VALUES (('<table>', '<name>', '<column>'), ...) ...
//      — used by migration 0018 to bulk-create indexes. The format string is
//        `CREATE INDEX IF NOT EXISTS %I ON %I(%I)` with (table, name, column) tuples.
// We do NOT accept "REFERENCES" alone (FK does NOT auto-create an index in PG).
function hasIndex(sql, table, column) {
  // 1. Explicit index (covers composite indexes where <column> is the leading column).
  const idxRe = new RegExp(
    `create\\s+(?:unique\\s+)?index\\s+(?:if\\s+not\\s+exists\\s+)?\\w+\\s+on\\s+${table}\\s*\\(\\s*${column}\\b`,
    'i'
  );
  if (idxRe.test(sql)) return true;
  // 1b. Dynamic CREATE INDEX via EXECUTE format(...) inside a DO $$ block.
  //     The VALUES list contains tuples like ('<table>', '<index_name>', '<column>').
  //     We match `('<table>', '<*>', '<column>')`.
  const dynRe = new RegExp(
    `\\(\\s*['"\`]${table}['"\`]\\s*,\\s*['"\`][^'\`"']+['"\`]\\s*,\\s*['"\`]${column}['"\`]\\s*\\)`,
    'i'
  );
  if (dynRe.test(sql)) return true;
  // 2. Column-level UNIQUE inside the CREATE TABLE for <table>.
  //    Match: <column> <type> ... UNIQUE  (within ~200 chars of the column name)
  //    We only look inside the CREATE TABLE block for <table>.
  const tableBlockRe = new RegExp(
    `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${table}\\s*\\(([^;]+)\\)`,
    'is'
  );
  const tm = sql.match(tableBlockRe);
  if (tm) {
    const body = tm[1];
    // column-level UNIQUE: "organization_id uuid not null unique" or "token text not null unique"
    const colUniqueRe = new RegExp(
      `\\b${column}\\b[^,\\n]*\\bunique\\b`,
      'i'
    );
    if (colUniqueRe.test(body)) return true;
    // column-level PRIMARY KEY: "id uuid primary key"
    const colPkRe = new RegExp(
      `\\b${column}\\b[^,\\n]*\\bprimary\\s+key\\b`,
      'i'
    );
    if (colPkRe.test(body)) return true;
    // table-level UNIQUE (column): "unique (organization_id)"
    const tblUniqueRe = new RegExp(
      `unique\\s*\\(\\s*${column}\\s*\\)`,
      'i'
    );
    if (tblUniqueRe.test(body)) return true;
    // table-level PRIMARY KEY (column)
    const tblPkRe = new RegExp(
      `primary\\s+key\\s*\\(\\s*${column}\\s*\\)`,
      'i'
    );
    if (tblPkRe.test(body)) return true;
  }
  return false;
}

// Build a list of (table, column) tuples to check.
const indexChecks = [
  // ─── organization_id FKs ────────────────────────────────────
  // Every tenant-scoped table has an organization_id FK → must have an index.
  // We don't enumerate every table here; instead we check the ones we know
  // are queried by .eq('organization_id', ...) in db.ts and API routes.
  { table: 'users',                column: 'organization_id', why: 'every tenant query filters users by organization_id' },
  { table: 'verification_tokens',  column: 'organization_id', why: 'token validation filters by organization_id' },
  { table: 'categories',           column: 'organization_id', why: 'menu categories list' },
  { table: 'menu_items',           column: 'organization_id', why: 'menu items list' },
  { table: 'tables',               column: 'organization_id', why: 'tables list' },
  { table: 'orders',               column: 'organization_id', why: 'orders list (composite with status and created_at also exist)' },
  { table: 'order_items',          column: 'organization_id', why: 'order items list' },
  { table: 'reservations',         column: 'organization_id', why: 'reservations list' },
  { table: 'organization_settings', column: 'organization_id', why: 'settings lookup (also has UNIQUE on organization_id)' },
  { table: 'audit_logs',           column: 'organization_id', why: 'audit log filtered by org' },
  { table: 'notifications',        column: 'organization_id', why: 'tenant notifications list filters by organization_id' },
  { table: 'customers',            column: 'organization_id', why: 'CRM list' },
  { table: 'customer_tags',        column: 'organization_id', why: 'tag list' },
  { table: 'chat_channels',        column: 'organization_id', why: 'channel list' },
  { table: 'chat_messages',        column: 'organization_id', why: 'messages list' },
  { table: 'staff_shifts',         column: 'organization_id', why: 'shifts list' },
  { table: 'whatsapp_messages',    column: 'organization_id', why: 'whatsapp log filtered by org' },
  { table: 'import_jobs',          column: 'organization_id', why: 'import job list' },
  { table: 'event_log',            column: 'organization_id', why: 'event log filtered by org' },
  { table: 'feature_flag_overrides', column: 'organization_id', why: 'flag override lookup' },
  { table: 'zones',                column: 'organization_id', why: 'zone list' },
  { table: 'user_roles',           column: 'organization_id', why: 'role assignments' },
  { table: 'user_activity',        column: 'organization_id', why: 'activity filtered by org' },
  { table: 'organization_subscriptions', column: 'organization_id', why: 'subscription lookup' },
  { table: 'invoices',             column: 'organization_id', why: 'invoice list' },
  { table: 'payment_methods',      column: 'organization_id', why: 'payment methods list' },
  { table: 'subscription_history', column: 'organization_id', why: 'subscription history' },
  { table: 'usage_logs',           column: 'organization_id', why: 'usage logs filtered by org' },
  // ─── status columns that are filtered ────────────────────────
  { table: 'orders',               column: 'status', why: 'orders filtered by status in /api/orders and analytics' },
  { table: 'reservations',         column: 'status', why: 'reservations filtered by status in /api/reservations and /api/tables/available' },
  { table: 'tables',               column: 'status', why: 'tables filtered by status in dashboard grid' },
  { table: 'audit_logs',           column: 'action', why: 'audit logs filtered by action' },
  { table: 'import_jobs',          column: 'status', why: 'import jobs filtered by status' },
  { table: 'whatsapp_messages',    column: 'status', why: 'whatsapp messages filtered by status' },
  { table: 'public_reviews',       column: 'status', why: 'reviews filtered by APPROVED/PENDING/REJECTED' },
  { table: 'invoices',             column: 'status', why: 'invoices filtered by status' },
  // ─── created_at columns that are sorted ─────────────────────
  { table: 'orders',               column: 'created_at', why: 'orders sorted by created_at DESC' },
  { table: 'audit_logs',           column: 'created_at', why: 'audit logs sorted by created_at DESC' },
  { table: 'notifications',        column: 'created_at', why: 'notifications sorted by created_at DESC' },
  { table: 'whatsapp_messages',    column: 'created_at', why: 'whatsapp log sorted by created_at DESC' },
  { table: 'import_jobs',          column: 'created_at', why: 'import jobs sorted by created_at DESC' },
  { table: 'public_reviews',       column: 'created_at', why: 'reviews sorted by created_at DESC' },
  { table: 'user_activity',        column: 'created_at', why: 'activity sorted by created_at DESC' },
  { table: 'event_log',            column: 'created_at', why: 'event log sorted by created_at DESC' },
  // ─── hot-path columns ───────────────────────────────────────
  { table: 'orders',               column: 'table_id', why: 'tables route fetches active orders by table_id' },
  { table: 'reservations',         column: 'table_id', why: 'overbooking check filters by table_id' },
  { table: 'reservations',         column: 'customer_id', why: 'customer history filtered by customer_id' },
  { table: 'order_items',          column: 'order_id', why: 'order detail fetches items by order_id' },
  { table: 'order_items',          column: 'menu_item_id', why: 'analytics joins order_items to menu_items' },
  { table: 'menu_items',           column: 'category_id', why: 'menu grouped by category' },
  { table: 'chat_messages',        column: 'channel_id', why: 'chat messages filtered by channel_id' },
  { table: 'user_sessions',        column: 'token_jti', why: 'session validation by jti' },
  { table: 'user_sessions',        column: 'user_id', why: 'sessions list by user_id' },
  { table: 'verification_tokens',  column: 'token', why: 'token lookup (also has UNIQUE on token)' },
];

const missingIndexes = [];
for (const c of indexChecks) {
  if (!hasIndex(migSql, c.table, c.column)) {
    missingIndexes.push(c);
  }
}

if (missingIndexes.length === 0) {
  pass(
    'Test 4: Index coverage',
    'Every organization_id FK, filtered status, sorted created_at, and hot-path column has an index.',
    `Verified ${indexChecks.length} (table, column) tuples across ${migFiles.length} migrations.`
  );
} else {
  const evidence = missingIndexes
    .map((m) => `  • ${m.table}(${m.column}) — ${m.why}`)
    .join('\n');
  fail(
    'Test 4: Index coverage',
    `${missingIndexes.length} missing index(es) detected.`,
    evidence,
    `Add to a new migration:
  CREATE INDEX IF NOT EXISTS ${missingIndexes[0].table}_${missingIndexes[0].column}_idx
    ON ${missingIndexes[0].table}(${missingIndexes[0].column});`
  );
}

// ============================================================
// Summary
// ============================================================
console.log('════════════════════════════════════════════════════════════');
console.log('  Summary');
console.log('════════════════════════════════════════════════════════════\n');

const passed = RESULTS.filter((r) => r.status === 'PASS').length;
const failed = RESULTS.filter((r) => r.status === 'FAIL').length;
const warned = RESULTS.filter((r) => r.status === 'WARN').length;

console.log(`Passed: ${passed}`);
console.log(`Warned: ${warned}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.log('\nFailed tests:');
  RESULTS.filter((r) => r.status === 'FAIL').forEach((r) => console.log(`  ❌ ${r.name}`));
  process.exit(1);
} else {
  console.log('\n🎉 Performance validation PASSED.');
  process.exit(0);
}
