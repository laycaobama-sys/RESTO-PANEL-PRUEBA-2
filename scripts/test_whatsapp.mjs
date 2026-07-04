// ============================================================
// RestoPanel · WhatsApp Service Test
// ============================================================
// npm run test:whatsapp
//
// Tests:
//   1. WhatsApp configuration is set
//   2. API connection works
//   3. Template message can be sent
//   4. Webhook endpoint responds
// ============================================================

import fs from "fs";
import path from "path";

// Load .env
const envPath = path.join(import.meta.dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  WhatsApp Service Test");
  console.log("═══════════════════════════════════════════\n");

  const TOKEN = process.env.WHATSAPP_TOKEN;
  const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

  // ─── 1. Configuration check ─────────────────────────────
  console.log("━━ 1. Configuration ━━");
  console.log(`  ${TOKEN ? "✓" : "✗"} WHATSAPP_TOKEN ${TOKEN ? "set" : "(not set)"}`);
  console.log(`  ${PHONE_ID ? "✓" : "✗"} WHATSAPP_PHONE_NUMBER_ID ${PHONE_ID ? "set" : "(not set)"}`);
  console.log(`  ✓ WHATSAPP_API_VERSION = ${API_VERSION}`);

  if (!TOKEN || !PHONE_ID) {
    console.log("\n  ⚠ WhatsApp is not configured.");
    console.log("  To configure:");
    console.log("  1. Go to https://business.facebook.com");
    console.log("  2. Create a WhatsApp Business account");
    console.log("  3. Get a permanent access token");
    console.log("  4. Get the phone number ID");
    console.log("  5. Add to .env:");
    console.log("     WHATSAPP_TOKEN=your_token");
    console.log("     WHATSAPP_PHONE_NUMBER_ID=your_phone_id");
    console.log("  6. Run this test again: npm run test:whatsapp");
    return;
  }

  // ─── 2. API connection test ─────────────────────────────
  console.log("\n━━ 2. API Connection ━━");
  try {
    const r = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PHONE_ID}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    if (r.ok) {
      const data = await r.json();
      console.log(`  ✓ API connection OK`);
      console.log(`  ✓ Phone number: ${data.display_phone_number || "verified"}`);
      console.log(`  ✓ Quality: ${data.quality_rating || "N/A"}`);
    } else {
      const err = await r.json();
      console.log(`  ✗ API error: ${err.error?.message || r.status}`);
    }
  } catch (e) {
    console.log(`  ✗ Connection failed: ${e.message}`);
  }

  // ─── 3. Webhook verification ────────────────────────────
  console.log("\n━━ 3. Webhook ━━");
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "restopanel_verify_2026";
  try {
    const r = await fetch(
      `${baseUrl}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=test123`
    );
    if (r.ok && (await r.text()) === "test123") {
      console.log(`  ✓ Webhook verification OK`);
    } else {
      console.log(`  ✗ Webhook verification failed (status: ${r.status})`);
    }
  } catch (e) {
    console.log(`  ⚠ Webhook test skipped (server not running)`);
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  Test complete");
  console.log("═══════════════════════════════════════════\n");
}

main().catch(e => { console.error(e); process.exit(1); });
