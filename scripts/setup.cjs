// ============================================================
// RestoPanel · One-command setup
// ============================================================
// npm run setup
//
// Does everything needed to get the project running:
//   1. Checks Node.js version
//   2. Installs npm dependencies (if node_modules missing)
//   3. Loads .env
//   4. Checks Supabase connection
//   5. Applies missing database migrations
//   6. Verifies the app builds
//   7. Reports status
//
// If migrations can't be applied automatically (sandbox), it
// generates scripts/apply-missing-migrations.sql with a single
// unified SQL file to run once in Supabase SQL Editor.
// ============================================================

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");

function log(msg) { console.log(`[setup] ${msg}`); }
function ok(msg) { console.log(`[setup] ✓ ${msg}`); }
function warn(msg) { console.log(`[setup] ⚠ ${msg}`); }
function fail(msg) { console.error(`[setup] ✗ ${msg}`); }

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  RestoPanel · Setup                          ║");
  console.log("║  npm run setup                                ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // ─── 1. Check Node version ──────────────────────────────
  log("Checking Node.js...");
  try {
    const nodeVersion = execSync("node --version", { encoding: "utf8" }).trim();
    const major = parseInt(nodeVersion.replace("v", "").split(".")[0]);
    if (major < 18) {
      fail(`Node.js 18+ required, found ${nodeVersion}`);
      process.exit(1);
    }
    ok(`Node.js ${nodeVersion}`);
  } catch (e) {
    fail("Node.js not found");
    process.exit(1);
  }

  // ─── 2. Install dependencies ────────────────────────────
  log("Checking dependencies...");
  if (!fs.existsSync(path.join(PROJECT_ROOT, "node_modules"))) {
    log("Installing npm dependencies...");
    try {
      execSync("npm install", { cwd: PROJECT_ROOT, stdio: "inherit" });
      ok("Dependencies installed");
    } catch (e) {
      fail("Failed to install dependencies");
      process.exit(1);
    }
  } else {
    ok("Dependencies already installed");
  }

  // ─── 3. Load .env ───────────────────────────────────────
  log("Loading .env...");
  const envPath = path.join(PROJECT_ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    fail(".env file not found. Copy .env.example to .env and fill in your Supabase credentials.");
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
  ok(".env loaded");

  // ─── 4. Check Supabase connection ───────────────────────
  log("Checking Supabase connection...");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    fail("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env");
    process.exit(1);
  }
  try {
    const resp = await fetch(`${supabaseUrl}/rest/v1/organizations?select=id&limit=1`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (resp.ok) {
      ok("Supabase connection OK");
    } else {
      fail(`Supabase connection failed: HTTP ${resp.status}`);
      process.exit(1);
    }
  } catch (e) {
    fail(`Supabase connection error: ${e.message}`);
    process.exit(1);
  }

  // ─── 5. Apply migrations ────────────────────────────────
  log("Running database migrations...");
  try {
    execSync("node scripts/db_setup.cjs", { cwd: PROJECT_ROOT, stdio: "inherit", env: process.env });
  } catch (e) {
    warn("Some migrations could not be applied automatically.");
    warn("Run the generated scripts/apply-missing-migrations.sql in Supabase SQL Editor, then re-run npm run setup.");
  }

  // ─── 6. Verify build ────────────────────────────────────
  log("Verifying build...");
  try {
    execSync("npx next build", { cwd: PROJECT_ROOT, stdio: "pipe", timeout: 120000 });
    ok("Build successful");
  } catch (e) {
    warn("Build had issues — check the output above.");
  }

  // ─── 7. Done ────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Setup complete!                             ║");
  console.log("║                                              ║");
  console.log("║  Start dev server:  npm run dev              ║");
  console.log("║  Start production:   npm run build && npm start");
  console.log("╚══════════════════════════════════════════════╝");
}

main().catch((e) => {
  fail(`Unexpected error: ${e.message}`);
  process.exit(1);
});
