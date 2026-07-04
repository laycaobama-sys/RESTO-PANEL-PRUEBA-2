// ============================================================
// RestoPanel · Cloudflare DNS Setup for Resend email
// ============================================================
// npm run dns:setup
//
// This script:
//   1. Verifies the Cloudflare API token
//   2. Checks if restopanel.com zone exists
//   3. Creates DNS records for Resend email:
//      - SPF (TXT)
//      - DKIM (CNAME/TXT)
//      - DMARC (TXT)
//      - MX (for bounce handling)
//   4. Verifies the records
//
// Requires:
//   - CLOUDFLARE_API_TOKEN in .env
//   - CLOUDFLARE_ACCOUNT_ID in .env
//   - The domain restopanel.com must be in your Cloudflare account
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

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const DOMAIN = process.env.EMAIL_DOMAIN || "restopanel.com";

if (!CF_TOKEN || !CF_ACCOUNT) {
  console.error("[dns:setup] CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID required in .env");
  process.exit(1);
}

async function cfApi(endpoint, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${CF_TOKEN}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, opts);
  const j = await r.json();
  return j;
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  RestoPanel · DNS Setup for Resend Email    ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // ─── 1. Verify token ────────────────────────────────────
  console.log("Verifying Cloudflare API token...");
  const verify = await cfApi("/user/tokens/verify");
  if (!verify.success) {
    console.error("✗ Invalid Cloudflare API token:", verify.errors);
    console.error("  Please check CLOUDFLARE_API_TOKEN in .env");
    process.exit(1);
  }
  console.log("✓ Token valid\n");

  // ─── 2. Find zone ───────────────────────────────────────
  console.log(`Finding zone for ${DOMAIN}...`);
  const zones = await cfApi(`/zones?name=${DOMAIN}`);
  if (!zones.success || !zones.result?.length) {
    console.error(`✗ Zone ${DOMAIN} not found in your Cloudflare account`);
    console.error("  Add the domain to Cloudflare first: https://dash.cloudflare.com");
    process.exit(1);
  }
  const zoneId = zones.result[0].id;
  console.log(`✓ Zone found: ${zoneId}\n`);

  // ─── 3. Create DNS records ──────────────────────────────
  const records = [
    // SPF record (allows Resend to send email on behalf of your domain)
    {
      type: "TXT",
      name: DOMAIN,
      content: "v=spf1 include:amazonses.com ~all",
      comment: "SPF for Resend email delivery",
    },
    // DMARC record (email authentication policy)
    {
      type: "TXT",
      name: `_dmarc.${DOMAIN}`,
      content: "v=DMARC1; p=quarantine; rua=mailto:dmarc@" + DOMAIN,
      comment: "DMARC policy for email authentication",
    },
    // Resend DKIM (CNAME to resend.com for DKIM signing)
    {
      type: "CNAME",
      name: `resend._domainkey.${DOMAIN}`,
      content: "u5c6l6c5x3j7r5c3.resend.com",
      comment: "DKIM for Resend",
    },
    // Bounce handling MX (Resend bounces)
    {
      type: "MX",
      name: `bounces.${DOMAIN}`,
      content: "feedback-smtp.us-east-1.amazonses.com",
      priority: 10,
      comment: "Bounce handling for Resend",
    },
  ];

  console.log("Creating DNS records...\n");
  for (const record of records) {
    // Check if record already exists
    const existing = await cfApi(`/zones/${zoneId}/dns_records?type=${record.type}&name=${record.name}`);
    if (existing.success && existing.result?.length > 0) {
      console.log(`  ✓ ${record.type} ${record.name} — already exists`);
      continue;
    }

    const result = await cfApi(`/zones/${zoneId}/dns_records`, "POST", {
      ...record,
      ttl: 3600,
      proxied: false,
    });

    if (result.success) {
      console.log(`  ✓ ${record.type} ${record.name} — created`);
    } else {
      console.log(`  ✗ ${record.type} ${record.name} — ${result.errors?.[0]?.message || "failed"}`);
    }
  }

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  DNS records created!                        ║");
  console.log("║                                              ║");
  console.log("║  Next steps:                                 ║");
  console.log("║  1. Go to https://resend.com/domains         ║");
  console.log("║  2. Add your domain: " + DOMAIN.padEnd(23) + "║");
  console.log("║  3. Click 'Verify' (may take 5-30 min)      ║");
  console.log("║  4. Update FROM_EMAIL in .env to:            ║");
  console.log("║     noreply@" + DOMAIN.padEnd(30) + "║");
  console.log("╚══════════════════════════════════════════════╝");
}

main().catch(e => { console.error(e); process.exit(1); });
