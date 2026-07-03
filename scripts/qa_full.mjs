// QA End-to-End — 100% pass target
const base = "http://localhost:3025";

function log(test, pass, detail = "") {
  console.log(`  ${pass ? "✓" : "✗"} ${test}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass });
  return log(name, pass, detail);
}

async function getCookie() {
  const csrfResp = await fetch(`${base}/api/auth/csrf`);
  const setCookie = csrfResp.headers.get("set-cookie") || "";
  const csrfToken = (await csrfResp.json()).csrfToken;
  const cookieMatch = setCookie.match(/(next-auth\.csrf-token=[^;]+)/);
  return { cookie: cookieMatch ? cookieMatch[1] : "", csrfToken };
}

async function login(email, password) {
  const { cookie, csrfToken } = await getCookie();
  const loginResp = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": cookie },
    body: new URLSearchParams({ email, password, csrfToken, json: "true" }),
    redirect: "manual",
  });
  const loginSetCookie = loginResp.headers.get("set-cookie") || "";
  return [cookie, ...loginSetCookie.split(/,(?=\s*[a-zA-Z_-]+)/)].filter(c => c.includes("=")).join("; ");
}

async function main() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  QA END-TO-END — RestoPanel (100% target)");
  console.log("═══════════════════════════════════════════\n");

  // ─── 1. VISITOR FLOW ────────────────────────────────────
  console.log("━━ 1. VISITOR FLOW ━━");
  const r1 = await fetch(`${base}/`, { redirect: "manual" });
  check("Visitor at / → redirects to /landing", r1.status === 307 || r1.status === 308, `status ${r1.status}, location: ${r1.headers.get("location")}`);

  const r2 = await fetch(`${base}/landing`);
  const h2 = await r2.text();
  check("/landing renders", r2.status === 200);
  check("Landing has GoogleReviews section", h2.includes("Gestión de Google Reviews"));
  check("Landing has no fake testimonials", !h2.includes("Carmen Zamorano"));
  check("Landing has no exposed credentials", !h2.includes("owner2026") && !h2.includes("demo1234"));
  check("Landing uses next/image (Image component)", h2.includes("_next/image") || h2.includes("data:image"));

  // /login should render auth screen
  const r3 = await fetch(`${base}/login`);
  check("/login renders", r3.status === 200);
  const h3 = await r3.text();
  check("/login has no exposed super admin creds", !h3.includes("owner2026"));

  // ─── 2. AUTH FLOW ───────────────────────────────────────
  console.log("\n━━ 2. AUTH FLOW ━━");
  const superAdminCookies = await login("owner@restopanel.es", "owner2026");
  const r4 = await fetch(`${base}/api/auth/session`, { headers: { Cookie: superAdminCookies } });
  const s4 = await r4.json();
  check("Super admin login", s4.user?.email === "owner@restopanel.es" && s4.user?.isSuperAdmin === true);

  const tenantCookies = await login("demo@lazamorana.es", "demo1234");
  const r5 = await fetch(`${base}/api/auth/session`, { headers: { Cookie: tenantCookies } });
  const s5 = await r5.json();
  check("Tenant admin login", s5.user?.email === "demo@lazamorana.es" && !s5.user?.isSuperAdmin);

  const wrongCookies = await login("demo@lazamorana.es", "wrongpassword");
  const r6 = await fetch(`${base}/api/auth/session`, { headers: { Cookie: wrongCookies } });
  const s6 = await r6.json();
  check("Wrong password rejected", !s6.user);

  // ─── 3. ROUTE PROTECTION ────────────────────────────────
  console.log("\n━━ 3. ROUTE PROTECTION ━━");
  const r7 = await fetch(`${base}/api/admin/stats`);
  check("Admin API without auth → 401", r7.status === 401);

  const r8 = await fetch(`${base}/api/admin/stats`, { headers: { Cookie: tenantCookies } });
  check("Admin API with tenant (non-super) → 403", r8.status === 403);

  const r9 = await fetch(`${base}/api/admin/stats`, { headers: { Cookie: superAdminCookies } });
  check("Admin API with super admin → 200", r9.status === 200);

  const r10 = await fetch(`${base}/api/reservations`);
  check("Tenant API without auth → 401", r10.status === 401);

  const r11 = await fetch(`${base}/api/reservations`, { headers: { Cookie: tenantCookies } });
  check("Tenant API with session → 200", r11.status === 200);

  // ─── 4. CRUD: RESERVATIONS ──────────────────────────────
  console.log("\n━━ 4. CRUD: RESERVATIONS ━━");
  const r12 = await fetch(`${base}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: tenantCookies },
    body: JSON.stringify({
      customerName: "QA Test Customer",
      phone: "+34600000000",
      email: "qa@test.com",
      partySize: 4,
      date: new Date(Date.now() + 86400000).toISOString(),
      shift: "DINNER",
      zone: "INTERIOR",
    }),
  });
  const j12 = await r12.json();
  check("Create reservation", r12.status === 201 || r12.status === 200, `status ${r12.status}`);
  const resvId = j12.id;

  const r13 = await fetch(`${base}/api/reservations`, { headers: { Cookie: tenantCookies } });
  const j13 = await r13.json();
  check("Read reservations list", Array.isArray(j13) || Array.isArray(j13?.reservations));
  check("Created reservation appears in list", JSON.stringify(j13).includes("QA Test Customer"));

  if (resvId) {
    const r14 = await fetch(`${base}/api/reservations/${resvId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: tenantCookies },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    check("Update reservation", r14.status === 200);

    const r15 = await fetch(`${base}/api/reservations/${resvId}`, {
      method: "DELETE",
      headers: { Cookie: tenantCookies },
    });
    check("Delete reservation", r15.status === 200 || r15.status === 204);
  }

  // ─── 5. CRUD: MENU ITEMS ────────────────────────────────
  console.log("\n━━ 5. CRUD: MENU ITEMS ━━");
  const r16 = await fetch(`${base}/api/categories`, { headers: { Cookie: tenantCookies } });
  const j16 = await r16.json();
  const catId = j16[0]?.id;
  check("Categories exist", j16.length > 0, `${j16.length} categories`);

  if (catId) {
    const r17 = await fetch(`${base}/api/menu`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: tenantCookies },
      body: JSON.stringify({ name: "QA Test Dish", description: "Plato de prueba", price: 15.50, categoryId: catId }),
    });
    const j17 = await r17.json();
    check("Create menu item", r17.status === 201 || r17.status === 200);
    const menuItemId = j17.id;

    const r18 = await fetch(`${base}/api/menu`, { headers: { Cookie: tenantCookies } });
    const j18 = await r18.json();
    check("Menu items list includes new item", JSON.stringify(j18).includes("QA Test Dish"));

    if (menuItemId) {
      const r19 = await fetch(`${base}/api/menu/${menuItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: tenantCookies },
        body: JSON.stringify({ price: 18.00 }),
      });
      check("Update menu item", r19.status === 200);

      const r20 = await fetch(`${base}/api/menu/${menuItemId}`, {
        method: "DELETE",
        headers: { Cookie: tenantCookies },
      });
      check("Delete menu item", r20.status === 200 || r20.status === 204);
    }
  }

  // ─── 6. CRM ─────────────────────────────────────────────
  console.log("\n━━ 6. CRM ━━");
  const r21 = await fetch(`${base}/api/customers`, { headers: { Cookie: tenantCookies } });
  check("List customers", r21.status === 200);

  // Use correct field name: fullName (camelCase)
  const r22 = await fetch(`${base}/api/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: tenantCookies },
    body: JSON.stringify({ fullName: "QA Test Client", phone: "+34 600 999 888", email: "qa2@test.com" }),
  });
  check("Create customer (fullName field)", r22.status === 200 || r22.status === 201, `status ${r22.status}`);

  // ─── 7. TABLES ──────────────────────────────────────────
  console.log("\n━━ 7. TABLES ━━");
  const r23 = await fetch(`${base}/api/tables`, { headers: { Cookie: tenantCookies } });
  check("List tables", r23.status === 200);
  const j23 = await r23.json();
  check("Tables have positions", j23.length > 0 && j23[0]?.pos_x !== undefined, `${j23.length} tables`);

  // ─── 8. PUBLIC REVIEWS ──────────────────────────────────
  console.log("\n━━ 8. PUBLIC REVIEWS ━━");
  const r24 = await fetch(`${base}/api/public/reviews`);
  const j24 = await r24.json();
  check("Public GET reviews", r24.status === 200);
  check("tableMissing = false (migration applied)", j24.tableMissing === false);

  const r25 = await fetch(`${base}/api/public/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      author_name: "QA Full Tester",
      author_role: "CLIENT",
      rating: 5,
      title: "Test 100% QA",
      body: "Esta reseña verifica el flujo completo del sistema automatizado.",
      tags: ["QA", "Test"],
    }),
  });
  const j25 = await r25.json();
  check("Submit review (auto-approved)", r25.status === 200 && j25.status === "APPROVED");

  const r26 = await fetch(`${base}/api/public/reviews`);
  const j26 = await r26.json();
  check("New review appears in public list", j26.reviews?.some(r => r.author_name === "QA Full Tester"));

  // ─── 9. WEB IMPORT ──────────────────────────────────────
  console.log("\n━━ 9. WEB IMPORT ━━");
  // Use example.com which works reliably
  const r27 = await fetch(`${base}/api/restaurant/import-web`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: tenantCookies },
    body: JSON.stringify({ url: "https://example.com" }),
  });
  const j27 = await r27.json();
  check("Web import with example.com", r27.status === 200 && !!j27.preview, `status ${r27.status}`);
  check("Web import detects restaurant name", j27.preview?.restaurant?.name === "Example Domain");
  check("Web import returns diff object", j27.preview?.diff !== undefined, "diff present");

  const r28 = await fetch(`${base}/api/restaurant/import-web`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: tenantCookies },
    body: JSON.stringify({ url: "not-a-url" }),
  });
  check("Web import rejects invalid URL", r28.status === 400);

  const r29 = await fetch(`${base}/api/restaurant/import-web`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com" }),
  });
  check("Web import without auth → 401", r29.status === 401);

  // ─── 10. EMAIL SERVICE ──────────────────────────────────
  console.log("\n━━ 10. EMAIL SERVICE ━━");
  // Test forgot-password (sends email in dev mode via console.log)
  const r30 = await fetch(`${base}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@lazamorana.es" }),
  });
  const j30 = await r30.json();
  check("Forgot password sends email", r30.status === 200 && j30.ok === true);

  // ─── 11. WHATSAPP SERVICE ───────────────────────────────
  console.log("\n━━ 11. WHATSAPP SERVICE ━━");
  // Test WhatsApp status endpoint
  const r31 = await fetch(`${base}/api/whatsapp/status`, { headers: { Cookie: tenantCookies } });
  const j31 = await r31.json();
  check("WhatsApp status endpoint", r31.status === 200);
  check("WhatsApp service responds with config", j31.config !== undefined);
  check("WhatsApp service has queue status", j31.queue !== undefined);

  // ─── 12. SUPER ADMIN ────────────────────────────────────
  console.log("\n━━ 12. SUPER ADMIN ━━");
  for (const ep of ["/api/admin/stats", "/api/admin/tenants", "/api/admin/users", "/api/admin/logs", "/api/admin/reviews", "/api/admin/notifications"]) {
    const r = await fetch(`${base}${ep}`, { headers: { Cookie: superAdminCookies } });
    check(`GET ${ep}`, r.status === 200);
  }

  // ─── 13. SEO ────────────────────────────────────────────
  console.log("\n━━ 13. SEO ━━");
  const r32 = await fetch(`${base}/robots.txt`);
  const t32 = await r32.text();
  check("robots.txt exists", r32.status === 200);
  check("robots.txt disallows /api/", t32.includes("/api/"));

  const r33 = await fetch(`${base}/sitemap.xml`);
  check("sitemap.xml exists", r33.status === 200);

  const r34 = await fetch(`${base}/llms.txt`);
  check("llms.txt exists", r34.status === 200);

  // ─── 14. LANDING METADATA ───────────────────────────────
  console.log("\n━━ 14. LANDING METADATA ━━");
  const h35 = await (await fetch(`${base}/landing`)).text();
  check("Has OG tags", h35.includes('og:title'));
  check("Has JSON-LD Organization", h35.includes('"@type":"Organization"'));
  check("Has JSON-LD SoftwareApplication", h35.includes('"@type":"SoftwareApplication"'));
  check("Has JSON-LD FAQPage", h35.includes('"@type":"FAQPage"'));
  check("Has JSON-LD Service", h35.includes('"@type":"Service"'));
  check("No hardcoded fake 4.8/127", !h35.includes('"ratingValue":"4.8","reviewCount":"127"'));

  // ─── 15. DATABASE SETUP SCRIPT ──────────────────────────
  console.log("\n━━ 15. DATABASE SETUP ━━");
  const { execSync } = await import("child_process");
  try {
    const output = execSync("node scripts/db_setup.cjs", {
      cwd: "/home/z/my-project",
      env: { ...process.env, PATH: process.env.PATH },
      timeout: 30000,
    }).toString();
    check("db:setup script runs", output.includes("All migrations are already applied") || output.includes("applied"));
  } catch (e) {
    check("db:setup script runs", false, e.message?.substring(0, 80));
  }

  // ─── SUMMARY ────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  const pct = Math.round((passed / total) * 100);
  console.log(`  RESULT: ${passed}/${total} tests passed (${pct}%)`);
  console.log("═══════════════════════════════════════════\n");

  if (pct < 100) {
    console.log("Failed tests:");
    results.filter(r => !r.pass).forEach(r => console.log(`  ✗ ${r.name}`));
  }

  process.exit(pct === 100 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
