// ============================================================
// RestoPanel · Apply pending migrations (one-command)
// ============================================================
// npm run db:apply
//
// This script:
//   1. Detects which migrations are missing
//   2. Generates a single SQL file with all missing migrations
//   3. Copies the SQL to clipboard (if xclip is available)
//   4. Opens the Supabase SQL Editor in the browser
//   5. Shows the SQL for manual paste
//
// After pasting and running in Supabase, run `npm run db:setup`
// to verify all migrations are applied.
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cttemgwmabzuhrbqzpsg.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "cttemgwmabzuhrbqzpsg";

async function probeTable(name) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${name}?select=id&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    return r.status !== 404;
  } catch { return false; }
}

async function probeColumn(table, column) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${column}&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (r.status === 400) {
      const j = await r.json();
      return !j.message?.includes("Could not find");
    }
    return r.status === 200;
  } catch { return false; }
}

const MIGRATIONS_DIR = path.join(PROJECT_ROOT, "supabase", "migrations");

const PROBES = [
  { file: "0001_init.sql", probe: async () => await probeTable("organizations") },
  { file: "0002_hardened_rls.sql", probe: async () => await probeTable("organizations") },
  { file: "0003_super_admin_audit.sql", probe: async () => await probeTable("audit_logs") },
  { file: "0004_notifications.sql", probe: async () => await probeTable("notifications") },
  { file: "0005_notifications_read.sql", probe: async () => await probeTable("notifications_read") },
  { file: "0006_crm_customers.sql", probe: async () => await probeTable("customers") },
  { file: "0007_chat_shifts.sql", probe: async () => await probeTable("chat_channels") },
  { file: "0008_table_groups.sql", probe: async () => await probeColumn("tables", "group_id") },
  { file: "0009_google_reviews.sql", probe: async () => await probeTable("public_reviews") },
  { file: "0010_fix_rls_recursion.sql", probe: async () => true },
  { file: "0011_user_blocked.sql", probe: async () => await probeColumn("users", "blocked") },
  { file: "0012_whatsapp_messages.sql", probe: async () => await probeTable("whatsapp_messages") },
  { file: "0013_import_jobs.sql", probe: async () => await probeTable("import_jobs") },
];

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  RestoPanel · Apply Pending Migrations       ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  console.log("Checking migration status...\n");
  const missing = [];
  for (const m of PROBES) {
    let applied;
    try { applied = await m.probe(); } catch { applied = false; }
    console.log(`  ${applied ? "✓" : "✗"} ${m.file} ${applied ? "(applied)" : "(MISSING)"}`);
    if (!applied) missing.push(m.file);
  }

  if (missing.length === 0) {
    console.log("\n✓ All migrations are already applied. Nothing to do.");
    return;
  }

  console.log(`\n${missing.length} migration(s) missing. Generating SQL...\n`);

  // Generate the SQL file
  const outputPath = path.join(PROJECT_ROOT, "scripts", "apply-missing-migrations.sql");
  let sql = `-- ============================================================\n`;
  sql += `-- RestoPanel · Missing Migrations (auto-generated)\n`;
  sql += `-- Run this ONCE in the Supabase SQL Editor\n`;
  sql += `-- ============================================================\n\n`;

  for (const file of missing) {
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    sql += `-- ════════════════════════════════════════════════════════\n`;
    sql += `-- MIGRATION: ${file}\n`;
    sql += `-- ════════════════════════════════════════════════════════\n\n`;
    sql += content + "\n\n";
  }

  fs.writeFileSync(outputPath, sql);
  console.log(`✓ SQL file generated: scripts/apply-missing-migrations.sql`);
  console.log(`  Size: ${(sql.length / 1024).toFixed(1)} KB\n`);

  // Try to copy to clipboard
  try {
    execSync(`echo ${JSON.stringify(sql)} | xclip -selection clipboard 2>/dev/null`, { stdio: "ignore" });
    console.log("✓ SQL copied to clipboard");
  } catch {
    try {
      execSync(`echo ${JSON.stringify(sql)} | pbcopy 2>/dev/null`, { stdio: "ignore" });
      console.log("✓ SQL copied to clipboard");
    } catch {
      console.log("  (Could not copy to clipboard — use the file)");
    }
  }

  // Open the Supabase SQL Editor
  const sqlEditorUrl = `https://supabase.com/dashboard/project/${REF}/sql/new`;
  console.log(`\n┌──────────────────────────────────────────────────────────┐`);
  console.log(`│  NEXT STEP (30 seconds):                                 │`);
  console.log(`│                                                          │`);
  console.log(`│  1. Supabase SQL Editor will open in your browser        │`);
  console.log(`│  2. Paste the SQL (Ctrl+V)                              │`);
  console.log(`│  3. Click "Run" (Ctrl+Enter)                            │`);
  console.log(`│  4. Run: npm run db:setup                                │`);
  console.log(`└──────────────────────────────────────────────────────────┘\n`);

  // Try to open browser
  try {
    execSync(`xdg-open "${sqlEditorUrl}" 2>/dev/null`, { stdio: "ignore" });
    console.log(`✓ Opened: ${sqlEditorUrl}`);
  } catch {
    try {
      execSync(`open "${sqlEditorUrl}" 2>/dev/null`, { stdio: "ignore" });
      console.log(`✓ Opened: ${sqlEditorUrl}`);
    } catch {
      console.log(`  Open manually: ${sqlEditorUrl}`);
    }
  }

  console.log(`\n  Or copy from: scripts/apply-missing-migrations.sql`);
}

main().catch(e => { console.error(e); process.exit(1); });
