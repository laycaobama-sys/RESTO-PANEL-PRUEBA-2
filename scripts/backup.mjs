// ============================================================
// RestoPanel · Database backup (JSON export)
// ============================================================
// npm run backup
//
// Exports all tenant data to a JSON file in backups/.
// Useful for manual backups before destructive operations.
//
// Note: For production, use Supabase's built-in PITR
// (Point-in-Time Recovery) instead of this script.
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("[backup] Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const TABLES = [
  "organizations",
  "organization_settings",
  "users",
  "categories",
  "menu_items",
  "tables",
  "orders",
  "order_items",
  "reservations",
  "customers",
  "customer_tags",
  "customer_tag_assignments",
  "zones",
  "notifications",
  "notifications_read",
  "chat_channels",
  "chat_messages",
  "staff_shifts",
  "audit_logs",
  "public_reviews",
  "google_review_settings",
  "import_jobs",
  "import_html_cache",
  "whatsapp_messages",
  "verification_tokens",
];

async function main() {
  const backupDir = path.join(import.meta.dirname, "..", "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.json`;
  const filepath = path.join(backupDir, filename);

  console.log(`[backup] Starting backup to ${filename}...`);

  const backup = {
    timestamp: new Date().toISOString(),
    supabaseUrl: url,
    tables: {},
  };

  let totalRows = 0;
  for (const table of TABLES) {
    try {
      const { data, error, count } = await supabase.from(table).select("*", { count: "exact" });
      if (error) {
        console.log(`  ⚠ ${table}: ${error.message}`);
        backup.tables[table] = { error: error.message, count: 0 };
      } else {
        backup.tables[table] = { count: data.length, data };
        totalRows += data.length;
        console.log(`  ✓ ${table}: ${data.length} rows`);
      }
    } catch (e) {
      console.log(`  ✗ ${table}: ${e.message}`);
      backup.tables[table] = { error: e.message, count: 0 };
    }
  }

  backup.totalRows = totalRows;
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
  const sizeMB = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
  console.log(`\n[backup] ✓ Backup complete: ${filename} (${sizeMB} MB, ${totalRows} rows)`);
  console.log(`[backup] Path: ${filepath}`);

  // Keep only the last 10 backups
  const backups = fs.readdirSync(backupDir).filter(f => f.startsWith("backup-")).sort().reverse();
  const oldBackups = backups.slice(10);
  for (const old of oldBackups) {
    fs.unlinkSync(path.join(backupDir, old));
    console.log(`[backup] Removed old backup: ${old}`);
  }
}

main().catch(e => { console.error("[backup] Error:", e); process.exit(1); });
