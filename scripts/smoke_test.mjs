// ============================================================
// RestoPanel · Production Smoke Test
// ============================================================
// npm run smoke-test
//
// Runs a comprehensive smoke test against a running instance
// (dev or production). Tests all critical endpoints and flows.
// ============================================================

const BASE = process.env.SMOKE_TEST_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const results = [];

function check(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Smoke Test — ${BASE}`);
  console.log(`═══════════════════════════════════════════\n`);

  // ─── 1. Public pages ────────────────────────────────────
  console.log("━━ 1. Public Pages ━━");
  const landing = await fetch(`${BASE}/landing`);
  check("Landing page", landing.status === 200);
  const landingHtml = await landing.text();
  check("Landing has content", landingHtml.length > 5000);

  const login = await fetch(`${BASE}/login`);
  check("Login page", login.status === 200);

  const robots = await fetch(`${BASE}/robots.txt`);
  check("robots.txt", robots.status === 200);

  const sitemap = await fetch(`${BASE}/sitemap.xml`);
  check("sitemap.xml", sitemap.status === 200);

  const llms = await fetch(`${BASE}/llms.txt`);
  check("llms.txt", llms.status === 200);

  // ─── 2. API Health ──────────────────────────────────────
  console.log("\n━━ 2. API Health ━━");
  const health = await fetch(`${BASE}/api/health`);
  const healthData = await health.json();
  check("Health endpoint", health.status === 200 || health.status === 503);
  check("Database OK", healthData.checks?.database?.status === "ok");
  check("Auth OK", healthData.checks?.auth?.status === "ok");
  check("Email configured", healthData.checks?.email?.status === "ok");
  check("WhatsApp configured", healthData.checks?.whatsapp?.status === "ok", healthData.checks?.whatsapp?.detail || "");

  // ─── 3. Auth ────────────────────────────────────────────
  console.log("\n━━ 3. Auth ━━");
  const csrf = await fetch(`${BASE}/api/auth/csrf`);
  check("CSRF endpoint", csrf.status === 200);
  const csrfData = await csrf.json();
  check("CSRF token returned", !!csrfData.csrfToken);

  const providers = await fetch(`${BASE}/api/auth/providers`);
  check("Auth providers", providers.status === 200);

  // ─── 4. Public API ──────────────────────────────────────
  console.log("\n━━ 4. Public API ━━");
  const reviews = await fetch(`${BASE}/api/public/reviews`);
  const reviewsData = await reviews.json();
  check("Public reviews GET", reviews.status === 200);
  check("Reviews table exists", reviewsData.tableMissing === false);

  // ─── 5. Protected API ───────────────────────────────────
  console.log("\n━━ 5. Protected API ━━");
  const adminNoAuth = await fetch(`${BASE}/api/admin/stats`);
  check("Admin API rejects no-auth", adminNoAuth.status === 401);

  const tenantNoAuth = await fetch(`${BASE}/api/reservations`);
  check("Tenant API rejects no-auth", tenantNoAuth.status === 401);

  // ─── 6. Security Headers ────────────────────────────────
  console.log("\n━━ 6. Security ━━");
  const secCheck = await fetch(`${BASE}/landing`);
  check("X-Frame-Options", secCheck.headers.get("x-frame-options") === "SAMEORIGIN");
  check("X-Content-Type-Options", secCheck.headers.get("x-content-type-options") === "nosniff");
  check("Referrer-Policy", secCheck.headers.get("referrer-policy") !== null);
  check("HSTS", secCheck.headers.get("strict-transport-security") !== null);
  check("No X-Powered-By", secCheck.headers.get("x-powered-by") === null);

  // ─── 7. Visitor redirect ────────────────────────────────
  console.log("\n━━ 7. Visitor Flow ━━");
  const root = await fetch(`${BASE}/`, { redirect: "manual" });
  check("Root redirects to /landing", root.status === 307 || root.status === 308, `→ ${root.headers.get("location")}`);

  // ─── Summary ────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  const pct = Math.round((passed / total) * 100);
  console.log(`  RESULT: ${passed}/${total} passed (${pct}%)`);
  console.log("═══════════════════════════════════════════\n");

  if (pct < 100) {
    console.log("Failed:");
    results.filter(r => !r.pass).forEach(r => console.log(`  ✗ ${r.name}`));
  }

  process.exit(pct >= 90 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
