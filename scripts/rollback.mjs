// ============================================================
// RestoPanel · Rollback Deployment
// ============================================================
// npm run rollback
//
// Rolls back to the previous Cloudflare Pages deployment.
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

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  RestoPanel · Rollback                       ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // List recent deployments
  console.log("Recent deployments:\n");
  try {
    const result = execSync(
      "npx wrangler pages deployment list --project-name restopanel 2>&1",
      { cwd: PROJECT_ROOT, encoding: "utf8", env: process.env, timeout: 30000 }
    );
    console.log(result);
  } catch (e) {
    console.log("Could not list deployments. Make sure wrangler is configured.");
    console.log("Error:", e.message?.substring(0, 80));
    process.exit(1);
  }

  // Ask which deployment to rollback to
  console.log("\nTo rollback, run:");
  console.log("  npx wrangler pages deployment rollback <deployment-id> --project-name restopanel");
  console.log("\nOr use the Cloudflare dashboard:");
  console.log("  https://dash.cloudflare.com → Pages → restopanel → Deployments");
}

main().catch(e => { console.error(e); process.exit(1); });
