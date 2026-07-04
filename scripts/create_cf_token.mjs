// ============================================================
// RestoPanel · Cloudflare Token Setup Helper
// ============================================================
// npm run cf:setup-token
//
// This script helps you create a Cloudflare API token with the
// correct permissions for deploying RestoPanel. It opens the
// Cloudflare token creation page with pre-filled settings.
// ============================================================

import { execSync } from "child_process";

const TOKEN_NAME = "restopanel-deploy";
const CREATE_URL = "https://dash.cloudflare.com/profile/api-tokens?name=" + encodeURIComponent(TOKEN_NAME);

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║  Cloudflare API Token Setup                          ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

console.log("Your current token can read account info but doesn't have");
console.log("deployment permissions. You need a token with:\n");

console.log("  Required permissions:");
console.log("    • Account → Cloudflare Pages → Edit");
console.log("    • Account → Workers Scripts → Edit");
console.log("    • Account → D1 → Edit");
console.log("    • Account → Workers KV Storage → Edit");
console.log("    • Zone → DNS → Edit (for DNS setup)");
console.log("    • Zone → Workers Routes → Edit\n");

console.log("  Opening Cloudflare token creation page...\n");

// Try to open browser
try {
  execSync(`xdg-open "${CREATE_URL}" 2>/dev/null`, { stdio: "ignore" });
  console.log("✓ Opened in browser");
} catch {
  try {
    execSync(`open "${CREATE_URL}" 2>/dev/null`, { stdio: "ignore" });
    console.log("✓ Opened in browser");
  } catch {
    console.log(`  Open manually: ${CREATE_URL}`);
  }
}

console.log("\n  After creating the token:");
console.log("  1. Copy the token value");
console.log("  2. Update .env: CLOUDFLARE_API_TOKEN=<your-new-token>");
console.log("  3. Run: npm run deploy:cf");
