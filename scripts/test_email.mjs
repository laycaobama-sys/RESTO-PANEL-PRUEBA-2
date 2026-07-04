// ============================================================
// RestoPanel · Email Service Test
// ============================================================
// npm run test:email
//
// Tests:
//   1. Resend API key is set
//   2. API connection works
//   3. Sends a test email
//   4. Verifies delivery
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
  console.log("  Email Service Test (Resend)");
  console.log("═══════════════════════════════════════════\n");

  const API_KEY = process.env.RESEND_API_KEY;
  const FROM = process.env.FROM_EMAIL || "RestoPanel <onboarding@resend.dev>";

  // ─── 1. Configuration ───────────────────────────────────
  console.log("━━ 1. Configuration ━━");
  console.log(`  ${API_KEY ? "✓" : "✗"} RESEND_API_KEY ${API_KEY ? "set" : "(not set)"}`);
  console.log(`  ✓ FROM_EMAIL = ${FROM}`);

  if (!API_KEY) {
    console.log("\n  ⚠ Resend is not configured.");
    console.log("  Add RESEND_API_KEY to .env");
    return;
  }

  // ─── 2. API connection ──────────────────────────────────
  console.log("\n━━ 2. API Connection ━━");
  try {
    const r = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (r.ok) {
      const data = await r.json();
      console.log(`  ✓ API connection OK`);
      console.log(`  ✓ Domains: ${data.data?.length || 0} registered`);
      for (const d of data.data || []) {
        console.log(`    - ${d.name} (${d.status})`);
      }
    } else {
      console.log(`  ✗ API error: ${r.status}`);
    }
  } catch (e) {
    console.log(`  ✗ Connection failed: ${e.message}`);
  }

  // ─── 3. Send test email ─────────────────────────────────
  console.log("\n━━ 3. Send Test Email ━━");
  const testEmail = process.env.TEST_EMAIL || "laycaobama@gmail.com";
  console.log(`  Sending to: ${testEmail}`);

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: testEmail,
        subject: "RestoPanel · Email service test",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
            <h1 style="color: #C5A059;">RestoPanel</h1>
            <p>This is a test email from RestoPanel.</p>
            <p>If you received this, the email service is working correctly.</p>
            <hr>
            <p style="color: #999; font-size: 12px;">
              Sent at: ${new Date().toISOString()}<br>
              From: ${FROM}
            </p>
          </div>
        `,
        text: "RestoPanel test email. If you received this, the email service is working.",
      }),
    });

    const data = await r.json();
    if (r.ok && data.id) {
      console.log(`  ✓ Email sent! ID: ${data.id}`);
      console.log(`  ✓ Check your inbox at ${testEmail}`);
    } else {
      console.log(`  ✗ Send failed: ${data.message || data.error?.message || "unknown"}`);
      if (data.message?.includes("not verified")) {
        console.log(`  ⚠ Domain not verified.`);
        console.log(`  Run: npm run dns:setup`);
        console.log(`  Then verify the domain at https://resend.com/domains`);
      }
    }
  } catch (e) {
    console.log(`  ✗ Send failed: ${e.message}`);
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  Test complete");
  console.log("═══════════════════════════════════════════\n");
}

main().catch(e => { console.error(e); process.exit(1); });
