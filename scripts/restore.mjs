// ============================================================
// RestoPanel · Database restore (from JSON backup)
// ============================================================
// npm run restore <backup-file>
//
// Restores data from a JSON backup file created by npm run backup.
// Usage: npm run restore backups/backup-2026-07-04T00-30-00.000Z.json
//
// WARNING: This OVERWRITES existing data. Use with caution.
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
  console.error("[restore] Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const backupFile = process.argv[2];
  if (!backupFile) {
    console.error("[restore] Usage: npm run restore <backup-file>");
    console.error("[restore] Example: npm run restore backups/backup-2026-07-04T00-30-00.000Z.json");
    process.exit(1);
  }

  const filepath = path.isAbsolute(backupFile)
    ? backupFile
    : path.join(import.meta.dirname, "..", backupFile);

  if (!fs.existsSync(filepath)) {
    console.error(`[restore] File not found: ${filepath}`);
    process.exit(1);
  }

  console.log(`[restore] Loading backup: ${path.basename(filepath)}`);
  const backup = JSON.parse(fs.readFileSync(filepath, "utf8"));

  console.log(`[restore] Backup from: ${backup.timestamp}`);
  console.log(`[restore] Total rows: ${backup.totalRows}`);
  console.log("");

  // Confirm
  console.log("⚠  WARNING: This will OVERWRITE existing data.");
  console.log("   Press Ctrl+C to cancel, or Enter to continue...");
  await new Promise(resolve => {
    process.stdin.resume();
    process.stdin.once("data", resolve);
  });

  console.log("\n[restore] Starting restore...\n");

  // Order matters for FK constraints — restore parent tables first
  const order = [
    "organizations",
    "organization_settings",
    "users",
    "verification_tokens",
    "categories",
    "menu_items",
    "tables",
    "zones",
    "orders",
    "order_items",
    "reservations",
    "customers",
    "customer_tags",
    "customer_tag_assignments",
    "notifications",
    "notifications_read",
    "chat_channels",
    "chat_messages",
    "staff_shifts",
    "audit_logs",
    "public_reviews",
    "google_review_settings",
    "import_jobs",
    "whatsapp_messages",
  ];

  let totalRestored = 0;
  for (const table of order) {
    const tableData = backup.tables[table];
    if (!tableData || tableData.error || !tableData.data || tableData.data.length === 0) {
      console.log(`  ⊘ ${table}: no data to restore`);
      continue;
    }

    try {
      // Clear existing data
      await supabaseAdmin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Insert backup data in batches of 100
      const batches = [];
      for (let i = 0; i < tableData.data.length; i += 100) {
        batches.push(tableData.data.slice(i, i + 100));
      }

      let inserted = 0;
      for (const batch of batches) {
        const { error } = await supabase.from(table).insert(batch);
        if (error) {
          console.log(`  ⚠ ${table}: ${error.message}`);
        } else {
          inserted += batch.length;
        }
      }

      totalRestored += inserted;
      console.log(`  ✓ ${table}: ${inserted}/${tableData.data.length} rows restored`);
    } catch (e) {
      console.log(`  ✗ ${table}: ${e.message}`);
    }
  }

  console.log(`\n[restore] ✓ Restore complete: ${totalRestored} rows restored`);
}

// Fix: use supabaseAdmin (defined below) instead of supabase
const supabaseAdmin = createClient(url, key, { auth: { persistSession: false } });

main().catch(e => { console.error("[restore] Error:", e); process.exit(1); });
