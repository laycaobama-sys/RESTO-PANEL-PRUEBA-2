// ============================================================
// RestoPanel · Deploy to Cloudflare Pages
// ============================================================
// npm run deploy:cf
//
// This script:
//   1. Verifies all environment variables are set
//   2. Builds the Next.js app
//   3. Deploys to Cloudflare Pages using Wrangler
//   4. Sets up secrets (if not already set)
//   5. Returns the deployment URL
// ============================================================

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.join(import.meta.dirname, "..");

// Load .env
const envPath = path.join(PROJECT_ROOT, ".env");
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

const REQUIRED = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "RESEND_API_KEY",
];

const OPTIONAL = [
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
];

function log(msg) { console.log(`[deploy:cf] ${msg}`); }
function ok(msg) { console.log(`[deploy:cf] ✓ ${msg}`); }
function fail(msg) { console.error(`[deploy:cf] ✗ ${msg}`); process.exit(1); }

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  RestoPanel · Cloudflare Pages Deploy       ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // ─── 1. Verify environment ──────────────────────────────
  log("Checking environment variables...");
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length > 0) {
    fail(`Missing required env vars: ${missing.join(", ")}`);
  }
  for (const k of REQUIRED) ok(`${k} is set`);
  for (const k of OPTIONAL) {
    if (process.env[k]) ok(`${k} is set`);
    else log(`  ⚠ ${k} not set (optional)`);
  }

  // ─── 2. Verify Cloudflare token ─────────────────────────
  log("\nVerifying Cloudflare API token...");
  try {
    const result = execSync(
      `npx wrangler whoami 2>&1`,
      { encoding: "utf8", env: process.env, timeout: 30000 }
    );
    if (result.includes("not authenticated") || result.includes("Invalid")) {
      fail("Cloudflare token is invalid. Check CLOUDFLARE_API_TOKEN in .env");
    }
    ok("Cloudflare token valid");
  } catch (e) {
    fail(`Cloudflare auth failed: ${e.message?.substring(0, 80)}`);
  }

  // ─── 3. Build ───────────────────────────────────────────
  log("\nBuilding Next.js app...");
  try {
    execSync("npm run build", { cwd: PROJECT_ROOT, stdio: "inherit", timeout: 120000 });
    ok("Build successful");
  } catch (e) {
    fail("Build failed");
  }

  // ─── 4. Deploy to Cloudflare Pages ──────────────────────
  log("\nDeploying to Cloudflare Pages...");
  try {
    const result = execSync(
      `npx wrangler pages deploy .next/standalone --project-name restopanel 2>&1`,
      { cwd: PROJECT_ROOT, encoding: "utf8", env: process.env, timeout: 120000 }
    );
    console.log(result);
    
    // Extract deployment URL
    const urlMatch = result.match(/https:\/\/[a-z0-9-]+\.restopanel\.pages\.dev/i);
    if (urlMatch) {
      ok(`Deployed to: ${urlMatch[0]}`);
    }
  } catch (e) {
    fail(`Deployment failed: ${e.message?.substring(0, 100)}`);
  }

  // ─── 5. Set secrets ─────────────────────────────────────
  log("\nSetting secrets (if needed)...");
  const secrets = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXTAUTH_SECRET",
    "RESEND_API_KEY",
    "WHATSAPP_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
  ];
  for (const secret of secrets) {
    if (process.env[secret]) {
      try {
        execSync(
          `echo "${process.env[secret]}" | npx wrangler pages secret put ${secret} --project-name restopanel 2>&1`,
          { cwd: PROJECT_ROOT, encoding: "utf8", env: process.env, timeout: 15000, stdio: "pipe" }
        );
        ok(`Secret ${secret} set`);
      } catch (e) {
        log(`  ⚠ Could not set secret ${secret} (may already be set)`);
      }
    }
  }

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Deploy complete!                            ║");
  console.log("╚══════════════════════════════════════════════╝");
}

main().catch(e => { console.error(e); process.exit(1); });
