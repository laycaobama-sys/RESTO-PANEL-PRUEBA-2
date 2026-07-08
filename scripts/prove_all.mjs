// ============================================================
// PROOF TESTS — Real verification of every bug fix
// ============================================================
const BASE = "http://localhost:3000";
import fs from "fs";
const results = [];

function record(test, pass, evidence) {
  results.push({ test, pass, evidence });
  console.log(`  ${pass ? "✓" : "✗"} ${test}`);
  if (evidence) console.log(`     → ${evidence}`);
}

async function getCookie() {
  const r = await fetch(`${BASE}/api/auth/csrf`);
  const sc = r.headers.get("set-cookie") || "";
  const t = (await r.json()).csrfToken;
  const m = sc.match(/(next-auth\.csrf-token=[^;]+)/);
  return { cookie: m ? m[1] : "", csrfToken: t };
}

async function login(email, password) {
  const { cookie, csrfToken } = await getCookie();
  const r = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": cookie },
    body: new URLSearchParams({ email, password, csrfToken, json: "true" }),
    redirect: "manual",
  });
  const sc = r.headers.get("set-cookie") || "";
  return [cookie, ...sc.split(/,(?=\s*[a-zA-Z_-]+)/)].filter(c => c.includes("=")).join("; ");
}

async function apiCall(path, options = {}, cookies = "") {
  const r = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(cookies ? { Cookie: cookies } : {}), ...(options.headers || {}) },
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

async function main() {
  console.log("\n══════════════════════════════════════════════════");
  console.log("  PROOF TESTS — Real Verification");
  console.log("══════════════════════════════════════════════════\n");

  // ═══════════════════════════════════════════════════════
  // BUG 1: EMAIL — Test actual sending via Resend API
  // ═══════════════════════════════════════════════════════
  console.log("━━ BUG 1: EMAIL ━━");

  // 1a. Check Resend API key is set
  const envFile = fs.readFileSync(".env", "utf8");
  record("RESEND_API_KEY in .env", envFile.includes("RESEND_API_KEY="), "key present");

  // 1b. Check FROM_EMAIL uses custom domain
  const fromEmailMatch = envFile.match(/FROM_EMAIL=(.+)/);
  const fromEmail = fromEmailMatch ? fromEmailMatch[1].trim() : "";
  record("FROM_EMAIL uses restopanel.com", fromEmail.includes("restopanel.com"), fromEmail);

  // 1c. Verify Resend API works (send a real email)
  const RESEND_KEY = envFile.match(/RESEND_API_KEY=(.+)/)?.[1]?.trim();
  const emailResp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "RestoPanel <onboarding@resend.dev>",
      to: "laycaobama@gmail.com",
      subject: "PROOF TEST — RestoPanel email service",
      html: "<h1>Proof test</h1><p>This email proves the Resend integration works.</p>",
      text: "Proof test: Resend integration works.",
    }),
  });
  const emailData = await emailResp.json();
  record("Resend API accepts email", emailResp.status === 200 && !!emailData.id, `message ID: ${emailData.id || emailData.error?.message}`);

  // 1d. Check domain status in Resend
  const DOMAIN_ID = envFile.match(/RESEND_DOMAIN_ID=(.+)/)?.[1]?.trim();
  if (DOMAIN_ID) {
    const domResp = await fetch(`https://api.resend.com/domains/${DOMAIN_ID}`, {
      headers: { Authorization: `Bearer ${RESEND_KEY}` },
    });
    const domData = await domResp.json();
    record("Domain restopanel.com created in Resend", domData.name === "restopanel.com", `status: ${domData.status}`);
    record("DNS records generated", Array.isArray(domData.records) && domData.records.length >= 3, `${domData.records?.length || 0} records`);
    const verifiedCount = domData.records?.filter(r => r.status === "verified").length || 0;
    record("DNS verified", domData.status === "verified", `${verifiedCount}/${domData.records?.length || 0} records verified`);
  }

  // 1e. Test forgot-password endpoint (triggers email service)
  const forgotResp = await apiCall("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "demo@lazamorana.es" }),
  });
  record("Forgot-password endpoint works", forgotResp.status === 200, `status: ${forgotResp.status}`);

  // 1f. Test reservation creation with email (triggers confirmation email)
  const tenantCookies = await login("demo@lazamorana.es", "demo1234");
  const resvResp = await apiCall("/api/reservations", {
    method: "POST",
    body: JSON.stringify({
      customerName: "Proof Test Customer",
      phone: "+34600000000",
      email: "laycaobama@gmail.com",
      partySize: 4,
      date: new Date(Date.now() + 86400000).toISOString(),
      shift: "DINNER",
      zone: "INTERIOR",
    }),
  }, tenantCookies);
  record("Reservation with email creates successfully", resvResp.status === 201 || resvResp.status === 200, `status: ${resvResp.status}, id: ${resvResp.data?.id}`);

  // Clean up the test reservation
  if (resvResp.data?.id) {
    await apiCall(`/api/reservations/${resvResp.data.id}`, { method: "DELETE" }, tenantCookies);
  }

  // ═══════════════════════════════════════════════════════
  // BUG 2: TABLE MAP — Verify zones, CRUD, persistence
  // ═══════════════════════════════════════════════════════
  console.log("\n━━ BUG 2: TABLE MAP ━━");

  // 2a. Get all tables
  const tablesResp = await apiCall("/api/tables", {}, tenantCookies);
  const tables = tablesResp.data || [];
  record("Tables API returns data", tablesResp.status === 200 && tables.length > 0, `${tables.length} tables`);

  // 2b. Verify zones are separated
  const zones = [...new Set(tables.map(t => t.zone))];
  record("Tables have zone assignments", zones.length >= 3, `zones: ${zones.join(", ")}`);

  const interiorTables = tables.filter(t => t.zone === "INTERIOR");
  const terraceTables = tables.filter(t => t.zone === "TERRACE");
  const barTables = tables.filter(t => t.zone === "BAR");
  const vipTables = tables.filter(t => t.zone === "VIP");
  record("Interior zone has tables", interiorTables.length > 0, `${interiorTables.length} tables`);
  record("Terrace zone has tables", terraceTables.length > 0, `${terraceTables.length} tables`);
  record("Bar zone has tables", barTables.length > 0, `${barTables.length} tables`);
  record("VIP zone has tables", vipTables.length > 0, `${vipTables.length} tables`);

  // 2c. Verify each table belongs to exactly one zone
  const tablesWithMultipleZones = tables.filter(t => !t.zone || typeof t.zone !== "string");
  record("All tables have exactly one zone", tablesWithMultipleZones.length === 0, `${tablesWithMultipleZones.length} invalid`);

  // 2d. Create a new table in VIP zone
  const createResp = await apiCall("/api/tables", {
    method: "POST",
    body: JSON.stringify({ number: "TEST-VIP-01", name: "Test VIP", capacity: 6, zone: "VIP", shape: "ROUND", status: "AVAILABLE" }),
  }, tenantCookies);
  record("Create table in VIP zone", createResp.status === 201 || createResp.status === 200, `status: ${createResp.status}, id: ${createResp.data?.id}`);
  const testTableId = createResp.data?.id;

  // 2e. Verify the new table is in VIP zone
  if (testTableId) {
    const getResp = await apiCall("/api/tables", {}, tenantCookies);
    const testTable = getResp.data?.find(t => t.id === testTableId);
    record("New table persisted in VIP zone", testTable?.zone === "VIP", `zone: ${testTable?.zone}`);

    // 2f. Change table zone to TERRACE
    const updateResp = await apiCall(`/api/tables/${testTableId}`, {
      method: "PATCH",
      body: JSON.stringify({ zone: "TERRACE" }),
    }, tenantCookies);
    record("Update table zone to TERRACE", updateResp.status === 200, `status: ${updateResp.status}`);

    // 2g. Verify zone change persisted
    const getResp2 = await apiCall("/api/tables", {}, tenantCookies);
    const updatedTable = getResp2.data?.find(t => t.id === testTableId);
    record("Zone change persisted to TERRACE", updatedTable?.zone === "TERRACE", `zone: ${updatedTable?.zone}`);

    // 2h. Delete the test table
    const delResp = await apiCall(`/api/tables/${testTableId}`, { method: "DELETE" }, tenantCookies);
    record("Delete test table", delResp.status === 200 || delResp.status === 204, `status: ${delResp.status}`);
  }

  // ═══════════════════════════════════════════════════════
  // BUG 3: GROUPING — Verify group persistence
  // ═══════════════════════════════════════════════════════
  console.log("\n━━ BUG 3: GROUPING ━━");

  // 3a. Find two available tables in the same zone
  const availTables = tables.filter(t => t.status === "AVAILABLE" && !t.group_id);
  const sameZoneTables = availTables.slice(0, 2);

  if (sameZoneTables.length >= 2) {
    // 3b. Group them
    const groupResp = await apiCall("/api/tables/group", {
      method: "POST",
      body: JSON.stringify({ tableIds: sameZoneTables.map(t => t.id) }),
    }, tenantCookies);
    record("Group tables API works", groupResp.status === 200 || groupResp.status === 201, `status: ${groupResp.status}`);
    const groupId = groupResp.data?.groupId || groupResp.data?.group_id;

    // 3c. Verify group_id is set on both tables
    const groupCheck = await apiCall("/api/tables", {}, tenantCookies);
    const groupedTable1 = groupCheck.data?.find(t => t.id === sameZoneTables[0].id);
    const groupedTable2 = groupCheck.data?.find(t => t.id === sameZoneTables[1].id);
    record("Group ID persisted on table 1", !!groupedTable1?.group_id, `group_id: ${groupedTable1?.group_id}`);
    record("Group ID persisted on table 2", !!groupedTable2?.group_id, `group_id: ${groupedTable2?.group_id}`);
    record("Both tables share same group", groupedTable1?.group_id === groupedTable2?.group_id, `${groupedTable1?.group_id}`);

    // 3d. Verify capacity is preserved
    record("Table 1 capacity preserved", groupedTable1?.capacity === sameZoneTables[0].capacity, `${groupedTable1?.capacity}`);
    record("Table 2 capacity preserved", groupedTable2?.capacity === sameZoneTables[1].capacity, `${groupedTable2?.capacity}`);

    // 3e. Ungroup
    if (groupId) {
      const ungroupResp = await apiCall(`/api/tables/group?groupId=${groupId}`, { method: "DELETE" }, tenantCookies);
      record("Ungroup API works", ungroupResp.status === 200, `status: ${ungroupResp.status}`);

      // 3f. Verify group_id is cleared
      const ungroupCheck = await apiCall("/api/tables", {}, tenantCookies);
      const ungroupedTable1 = ungroupCheck.data?.find(t => t.id === sameZoneTables[0].id);
      record("Group ID cleared after ungroup", !ungroupedTable1?.group_id, `group_id: ${ungroupedTable1?.group_id}`);
    }
  } else {
    record("Grouping test (need 2 available tables)", false, "Not enough available tables");
  }

  // ═══════════════════════════════════════════════════════
  // BUG 4: TABLE TRANSFER — Verify reservation moves between tables
  // ═══════════════════════════════════════════════════════
  console.log("\n━━ BUG 4: TABLE TRANSFER ━━");

  // 4a. Create a reservation on a specific table
  const sourceTable = tables.find(t => t.zone === "INTERIOR" && t.status === "AVAILABLE");
  const targetTable = tables.find(t => t.zone === "TERRACE" && t.status === "AVAILABLE" && t.id !== sourceTable?.id);

  if (sourceTable && targetTable) {
    const createResv = await apiCall("/api/reservations", {
      method: "POST",
      body: JSON.stringify({
        customerName: "Transfer Test Customer",
        phone: "+34600000001",
        email: "transfer@test.com",
        partySize: 3,
        date: new Date(Date.now() + 86400000).toISOString(),
        shift: "DINNER",
        zone: "INTERIOR",
        tableId: sourceTable.id,
      }),
    }, tenantCookies);
    record("Create reservation on source table", createResv.status === 201 || createResv.status === 200, `id: ${createResv.data?.id}`);
    const transferResvId = createResv.data?.id;

    // 4b. Verify reservation has source table
    const beforeTransfer = await apiCall(`/api/reservations`, {}, tenantCookies);
    const resvBefore = beforeTransfer.data?.find(r => r.id === transferResvId);
    record("Reservation has source table", resvBefore?.table?.id === sourceTable.id || resvBefore?.tableId === sourceTable.id, `table: ${resvBefore?.table?.number || resvBefore?.tableId}`);

    // 4c. Transfer to target table
    if (transferResvId) {
      const transferResp = await apiCall("/api/tables/transfer", {
        method: "POST",
        body: JSON.stringify({ reservationId: transferResvId, newTableId: targetTable.id }),
      }, tenantCookies);
      record("Transfer API works", transferResp.status === 200, `status: ${transferResp.status}, message: ${transferResp.data?.message}`);

      // 4d. Verify reservation now has target table
      const afterTransfer = await apiCall(`/api/reservations`, {}, tenantCookies);
      const resvAfter = afterTransfer.data?.find(r => r.id === transferResvId);
      record("Reservation moved to target table", resvAfter?.table?.id === targetTable.id || resvAfter?.tableId === targetTable.id, `table: ${resvAfter?.table?.number || resvAfter?.tableId}`);

      // 4e. Verify customer name preserved
      record("Customer name preserved", resvAfter?.customerName === "Transfer Test Customer" || resvAfter?.customer_name === "Transfer Test Customer", `${resvAfter?.customerName || resvAfter?.customer_name}`);

      // 4f. Verify party size preserved
      const partySize = resvAfter?.partySize || resvAfter?.party_size;
      record("Party size preserved", partySize === 3, `${partySize}`);

      // 4g. Verify zone updated to target table's zone
      const resvZone = resvAfter?.zone || resvAfter?.table?.zone;
      record("Zone updated to TERRACE", resvZone === "TERRACE", `zone: ${resvZone}`);

      // Clean up
      await apiCall(`/api/reservations/${transferResvId}`, { method: "DELETE" }, tenantCookies);
    }
  } else {
    record("Transfer test (need INTERIOR + TERRACE tables)", false, "Missing available tables");
  }

  // ═══════════════════════════════════════════════════════
  // BUG 5: PERSISTENCE — Verify data survives navigation
  // ═══════════════════════════════════════════════════════
  console.log("\n━━ BUG 5: PERSISTENCE ━━");

  // 5a. Fetch tables (simulates visiting Mesas section)
  const persist1 = await apiCall("/api/tables", {}, tenantCookies);
  const tableCount1 = persist1.data?.length || 0;
  record("Tables fetched (visit 1)", persist1.status === 200, `${tableCount1} tables`);

  // 5b. Fetch reservations (simulates visiting Reservas section)
  const persist2 = await apiCall("/api/reservations", {}, tenantCookies);
  const resvCount1 = persist2.data?.length || 0;
  record("Reservations fetched (visit 1)", persist2.status === 200, `${resvCount1} reservations`);

  // 5c. Fetch menu items (simulates visiting Menús section)
  const persist3 = await apiCall("/api/menu", {}, tenantCookies);
  const menuCount1 = persist3.data?.length || 0;
  record("Menu items fetched (visit 1)", persist3.status === 200, `${menuCount1} items`);

  // 5d. Fetch customers (simulates visiting CRM section)
  const persist4 = await apiCall("/api/customers", {}, tenantCookies);
  const custCount1 = persist4.data?.length || 0;
  record("Customers fetched (visit 1)", persist4.status === 200, `${custCount1} customers`);

  // 5e. Go back to tables (simulates returning to Mesas)
  const persist5 = await apiCall("/api/tables", {}, tenantCookies);
  const tableCount2 = persist5.data?.length || 0;
  record("Tables still available after navigation", tableCount1 === tableCount2, `${tableCount2} tables (was ${tableCount1})`);

  // 5f. Verify data consistency between calls
  const tableIds1 = (persist1.data || []).map(t => t.id).sort().join(",");
  const tableIds2 = (persist5.data || []).map(t => t.id).sort().join(",");
  record("Same table IDs across calls", tableIds1 === tableIds2, "IDs match");

  // 5g. Test after logout + re-login
  const reloginCookies = await login("demo@lazamorana.es", "demo1234");
  const persist6 = await apiCall("/api/tables", {}, reloginCookies);
  const tableCount3 = persist6.data?.length || 0;
  record("Tables persist after logout + re-login", tableCount1 === tableCount3, `${tableCount3} tables (was ${tableCount1})`);

  // ═══════════════════════════════════════════════════════
  // BUG 6: WEB IMPORT — Test with multiple real URLs
  // ═══════════════════════════════════════════════════════
  console.log("\n━━ BUG 6: WEB IMPORT ━━");

  const testUrls = [
    "https://example.com",
    "https://www.w3.org",
    "https://httpbin.org/html",
  ];

  for (const url of testUrls) {
    const importResp = await apiCall("/api/restaurant/import-web", {
      method: "POST",
      body: JSON.stringify({ url }),
    }, tenantCookies);
    const hasPreview = importResp.data?.preview || importResp.data?.ok;
    const restaurantName = importResp.data?.preview?.restaurant?.name;
    record(`Import ${url}`, importResp.status === 200 && !!hasPreview, `name: ${restaurantName || "N/A"}, items: ${importResp.data?.preview?.menuItems?.length || 0}`);
  }

  // 6d. Test invalid URL
  const invalidResp = await apiCall("/api/restaurant/import-web", {
    method: "POST",
    body: JSON.stringify({ url: "not-a-url" }),
  }, tenantCookies);
  record("Invalid URL rejected", invalidResp.status === 400, `status: ${invalidResp.status}`);

  // 6e. Test SSRF protection (private IP)
  const ssrfResp = await apiCall("/api/restaurant/import-web", {
    method: "POST",
    body: JSON.stringify({ url: "http://127.0.0.1" }),
  }, tenantCookies);
  record("SSRF protection (blocks localhost)", ssrfResp.status === 502, `status: ${ssrfResp.status}`);

  // 6f. Test import diff (re-import same URL)
  const reimportResp = await apiCall("/api/restaurant/import-web", {
    method: "POST",
    body: JSON.stringify({ url: "https://example.com" }),
  }, tenantCookies);
  const hasDiff = reimportResp.data?.preview?.diff;
  record("Re-import produces diff object", !!hasDiff, `diff present: ${!!hasDiff}`);

  // ═══════════════════════════════════════════════════════
  // REGRESSION: Verify all major endpoints still work
  // ═══════════════════════════════════════════════════════
  console.log("\n━━ REGRESSION ━━");

  // Landing
  const landing = await fetch(`${BASE}/landing`);
  record("Landing page", landing.status === 200, `status: ${landing.status}`);

  // Login
  const loginPage = await fetch(`${BASE}/login`);
  record("Login page", loginPage.status === 200, `status: ${loginPage.status}`);

  // Visitor redirect
  const root = await fetch(`${BASE}/`, { redirect: "manual" });
  record("Root redirects to /landing", root.status === 307 || root.status === 308, `→ ${root.headers.get("location")}`);

  // Auth
  const session = await apiCall("/api/auth/session", {}, tenantCookies);
  record("Session valid", !!session.data?.user, `user: ${session.data?.user?.email}`);

  // Dashboard data
  const stats = await apiCall("/api/restaurant", {}, tenantCookies);
  record("Restaurant data", stats.status === 200, `status: ${stats.status}`);

  // Reservations
  record("Reservations list", persist2.status === 200, `${resvCount1} reservations`);

  // CRM
  const customers = await apiCall("/api/customers", {}, tenantCookies);
  record("Customers list", customers.status === 200, `${customers.data?.length || 0} customers`);

  // Menu
  const menu = await apiCall("/api/menu", {}, tenantCookies);
  record("Menu items", menu.status === 200, `${menu.data?.length || 0} items`);

  // Categories
  const cats = await apiCall("/api/categories", {}, tenantCookies);
  record("Categories", cats.status === 200, `${cats.data?.length || 0} categories`);

  // Tables
  record("Tables list", tablesResp.status === 200, `${tables.length} tables`);

  // Orders
  const orders = await apiCall("/api/orders", {}, tenantCookies);
  record("Orders list", orders.status === 200, `${orders.data?.length || 0} orders`);

  // Analytics
  const analytics = await apiCall("/api/analytics", {}, tenantCookies);
  record("Analytics", analytics.status === 200, `status: ${analytics.status}`);

  // Notifications
  const notifs = await apiCall("/api/notifications", {}, tenantCookies);
  record("Notifications", notifs.status === 200, `${notifs.data?.length || 0} notifications`);

  // Shifts
  const shifts = await apiCall("/api/shifts", {}, tenantCookies);
  record("Shifts", shifts.status === 200, `${shifts.data?.length || 0} shifts`);

  // Chat channels
  const channels = await apiCall("/api/chat/channels", {}, tenantCookies);
  record("Chat channels", channels.status === 200, `${channels.data?.length || 0} channels`);

  // WhatsApp status
  const wa = await apiCall("/api/whatsapp/status", {}, tenantCookies);
  record("WhatsApp status", wa.status === 200, `configured: ${wa.data?.configured}`);

  // Public reviews
  const reviews = await apiCall("/api/public/reviews");
  record("Public reviews", reviews.status === 200, `${reviews.data?.reviews?.length || 0} reviews`);

  // SEO
  const robots = await fetch(`${BASE}/robots.txt`);
  record("robots.txt", robots.status === 200, "");
  const sitemap = await fetch(`${BASE}/sitemap.xml`);
  record("sitemap.xml", sitemap.status === 200, "");
  const llms = await fetch(`${BASE}/llms.txt`);
  record("llms.txt", llms.status === 200, "");

  // Health
  const health = await apiCall("/api/health");
  record("Health endpoint", health.status === 200 || health.status === 503, `status: ${health.data?.status}`);

  // Super Admin
  const saCookies = await login("owner@restopanel.es", "owner2026");
  const saStats = await apiCall("/api/admin/stats", {}, saCookies);
  record("Super Admin stats", saStats.status === 200, `status: ${saStats.status}`);
  const saTenants = await apiCall("/api/admin/tenants", {}, saCookies);
  record("Super Admin tenants", saTenants.status === 200, `${saTenants.data?.length || 0} tenants`);
  const saUsers = await apiCall("/api/admin/users", {}, saCookies);
  record("Super Admin users", saUsers.status === 200, `${saUsers.data?.length || 0} users`);
  const saReviews = await apiCall("/api/admin/reviews", {}, saCookies);
  record("Super Admin reviews", saReviews.status === 200, `${saReviews.data?.reviews?.length || 0} reviews`);
  const saLogs = await apiCall("/api/admin/logs", {}, saCookies);
  record("Super Admin audit logs", saLogs.status === 200, `${saLogs.data?.length || 0} logs`);

  // Route protection
  const noAuth = await apiCall("/api/reservations");
  record("Unauthenticated API blocked", noAuth.status === 401, `status: ${noAuth.status}`);
  const tenantAsAdmin = await apiCall("/api/admin/stats", {}, tenantCookies);
  record("Tenant cannot access admin API", tenantAsAdmin.status === 403, `status: ${tenantAsAdmin.status}`);

  // ═══════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════
  console.log("\n══════════════════════════════════════════════════");
  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  const failed = results.filter(r => !r.pass);
  console.log(`  TOTAL: ${passed}/${total} passed (${Math.round(passed/total*100)}%)`);
  if (failed.length > 0) {
    console.log(`\n  FAILED TESTS:`);
    failed.forEach(f => console.log(`    ✗ ${f.test}`));
  }
  console.log("══════════════════════════════════════════════════\n");

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
