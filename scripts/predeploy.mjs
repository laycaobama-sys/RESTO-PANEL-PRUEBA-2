// Pre-deployment checks
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.join(import.meta.dirname, "..");
const results = [];

function check(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function grepInSrc(pattern) {
  try {
    const out = execSync(`grep -rn '${pattern.replace(/'/g, "'\\''")}' src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true`, {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    });
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

async function main() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Pre-deployment checks");
  console.log("═══════════════════════════════════════════\n");

  // ─── 1. Environment variables ───────────────────────────
  console.log("━━ 1. Environment ━━");
  const envPath = path.join(PROJECT_ROOT, ".env");
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, "utf8");
    const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXTAUTH_SECRET", "NEXTAUTH_URL"];
    for (const key of required) check(`${key} set`, env.includes(`${key}=`));
    const optional = ["RESEND_API_KEY", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"];
    for (const key of optional) check(`${key} ${env.match(new RegExp(`^${key}=.+`, "m")) ? "set" : "(optional, not set)"}`, true);
  } else {
    check(".env file exists", false);
  }

  // ─── 2. TypeScript ──────────────────────────────────────
  console.log("\n━━ 2. TypeScript ━━");
  try {
    execSync("npx tsc --noEmit", { cwd: PROJECT_ROOT, stdio: "pipe", timeout: 60000 });
    check("TypeScript compilation", true);
  } catch (e) {
    const output = e.stdout?.toString() || e.stderr?.toString() || "";
    const ourErrors = output.split("\n").filter(l => l.startsWith("src/") && !l.includes("ui/chart.tsx"));
    check("TypeScript compilation", ourErrors.length === 0, `${ourErrors.length} errors in our code`);
    if (ourErrors.length > 0) ourErrors.slice(0, 5).forEach(e => console.log(`     ${e.substring(0, 100)}`));
  }

  // ─── 3. Build ───────────────────────────────────────────
  console.log("\n━━ 3. Build ━━");
  try {
    execSync("npx next build", { cwd: PROJECT_ROOT, stdio: "pipe", timeout: 120000 });
    check("Next.js build", true);
  } catch (e) {
    check("Next.js build", false, e.message?.substring(0, 80));
  }

  // ─── 4. Database migrations ─────────────────────────────
  console.log("\n━━ 4. Database ━━");
  try {
    const output = execSync("node scripts/db_setup.cjs", { cwd: PROJECT_ROOT, stdio: "pipe", timeout: 30000, env: process.env }).toString();
    const allApplied = output.includes("All migrations") && !output.includes("MISSING");
    check("All migrations applied", allApplied);
    if (!allApplied) console.log("     Run scripts/apply-missing-migrations.sql in Supabase SQL Editor.");
  } catch (e) {
    check("Database setup", false, e.message?.substring(0, 80));
  }

  // ─── 5. Security scan ───────────────────────────────────
  console.log("\n━━ 5. Security ━━");
  const nextAuthContent = fs.readFileSync(path.join(PROJECT_ROOT, "src/lib/next-auth.ts"), "utf8");
  const middlewareContent = fs.readFileSync(path.join(PROJECT_ROOT, "src/middleware.ts"), "utf8");
  check("NEXTAUTH_SECRET not hardcoded", !nextAuthContent.includes("RestoPanel_Dev_Secret"));
  check("No dev secret fallback in middleware", !middlewareContent.includes("RestoPanel_Dev_Secret"));

  // Check for exposed credentials in client components
  const authScreen = fs.readFileSync(path.join(PROJECT_ROOT, "src/components/auth/AuthScreen.tsx"), "utf8");
  check("No super admin creds in AuthScreen", !authScreen.includes("owner2026") && !authScreen.includes("owner@restopanel.es"));
  check("No demo creds in AuthScreen", !authScreen.includes("demo1234"));

  // Check for console.log in production code (excluding lib/email, lib/whatsapp which are intentional)
  const consoleLogFiles = grepInSrc("console\\.log").filter(l =>
    !l.includes("lib/email.ts") &&
    !l.includes("lib/whatsapp.ts") &&
    !l.includes("scripts/")
  );
  check("No console.log in production code", consoleLogFiles.length === 0, consoleLogFiles.length > 0 ? `${consoleLogFiles.length} found` : "");

  // ─── Summary ────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  const pct = Math.round((passed / total) * 100);
  console.log(`  RESULT: ${passed}/${total} checks passed (${pct}%)`);
  console.log("═══════════════════════════════════════════\n");
  process.exit(pct === 100 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
