// ============================================================
// RestoPanel · Database Setup (single command bootstrap)
// ============================================================
// npm run db:setup
//
// What it does:
//   1. Loads .env automatically
//   2. Probes the live Supabase instance via REST to detect
//      which migrations are already applied.
//   3. Tries to apply missing migrations via direct Postgres
//      connection (if reachable from this environment).
//   4. If Postgres is unreachable (sandbox/CI), generates a
//      single concatenated SQL file with ONLY the missing
//      migrations at scripts/apply-missing-migrations.sql
//      and prints a one-line instruction.
//
// Idempotent: safe to run multiple times.
// ============================================================

const fs = require("fs");
const path = require("path");

// ─── Load .env manually (no dotenv dependency) ────────────────
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cttemgwmabzuhrbqzpsg.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MIGRATIONS_DIR = path.join(__dirname, "../supabase/migrations");

if (!SERVICE_KEY) {
  console.error("[db:setup] SUPABASE_SERVICE_ROLE_KEY is required in .env");
  process.exit(1);
}

async function probeTable(name) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${name}?select=id&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    return r.status !== 404;
  } catch {
    return false;
  }
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
  } catch {
    return false;
  }
}

const MIGRATION_PROBES = [
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
];

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  RestoPanel · Database Setup                 ║");
  console.log("║  npm run db:setup                             ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  console.log("Probing live database for migration status...\n");
  const missing = [];
  for (const m of MIGRATION_PROBES) {
    let applied;
    try {
      applied = await m.probe();
    } catch {
      applied = false;
    }
    console.log(`  ${applied ? "✓" : "✗"} ${m.file} ${applied ? "(applied)" : "(MISSING)"}`);
    if (!applied) missing.push(m.file);
  }

  if (missing.length === 0) {
    console.log("\n[db:setup] ✓ All migrations are already applied. Nothing to do.");
    return;
  }

  console.log(`\n[db:setup] ${missing.length} migration(s) missing. Attempting direct Postgres connection...\n`);

  // Try direct PG connection
  let client = null;
  try {
    const { Client } = require("pg");
    const REF = "cttemgwmabzuhrbqzpsg";
    const PASSWORD = process.env.SUPABASE_DB_PASSWORD || "RestoPanel_Supa_2026!";
    const hosts = [
      "aws-0-eu-west-1.pooler.supabase.com",
      "aws-0-eu-central-1.pooler.supabase.com",
      "aws-0-us-east-1.pooler.supabase.com",
      `db.${REF}.supabase.co`,
    ];
    for (const host of hosts) {
      for (const user of [`postgres.${REF}`, "postgres"]) {
        try {
          const c = new Client({
            connectionString: `postgresql://${user}:${encodeURIComponent(PASSWORD)}@${host}:5432/postgres`,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 6000,
          });
          await c.connect();
          client = c;
          console.log(`[db:setup] Connected via ${host}`);
          break;
        } catch {}
      }
      if (client) break;
    }

    if (client) {
      for (const file of missing) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
        try {
          await client.query("BEGIN");
          await client.query(sql);
          await client.query("COMMIT");
          console.log(`  ✓ ${file} — applied`);
        } catch (err) {
          await client.query("ROLLBACK").catch(() => {});
          console.log(`  ✗ ${file} — FAILED: ${err.message.substring(0, 100)}`);
        }
      }
      await client.end();
      console.log("\n[db:setup] ✓ Done.");
      return;
    }
  } catch (e) {
    // pg not available or connection failed
  }

  // Fallback: generate single SQL file
  console.log("[db:setup] Direct Postgres connection not available in this environment.");
  console.log("[db:setup] Generating single SQL file with missing migrations...\n");

  const outputPath = path.join(__dirname, "apply-missing-migrations.sql");
  let output = "-- ============================================================\n";
  output += "-- RestoPanel · Missing Migrations (auto-generated)\n";
  output += "-- Run this ONCE in the Supabase SQL Editor:\n";
  output += `-- ${SUPABASE_URL.replace("https://", "https://supabase.com/dashboard/project/")}/sql/new\n`;
  output += "-- ============================================================\n\n";

  for (const file of missing) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    output += `-- ════════════════════════════════════════════════════════\n`;
    output += `-- MIGRATION: ${file}\n`;
    output += `-- ════════════════════════════════════════════════════════\n\n`;
    output += sql + "\n\n";
  }

  fs.writeFileSync(outputPath, output);
  console.log(`  ✓ Generated: scripts/apply-missing-migrations.sql`);
  console.log(`\n[db:setup] NEXT STEP (one-time):`);
  console.log(`  1. Open: ${SUPABASE_URL.replace("https://", "https://supabase.com/dashboard/project/")}/sql/new`);
  console.log(`  2. Paste the contents of scripts/apply-missing-migrations.sql`);
  console.log(`  3. Click Run`);
  console.log(`\n  Then run \`npm run db:setup\` again to verify.`);
}

main().catch((e) => {
  console.error("[db:setup] Fatal:", e.message);
  process.exit(1);
});
