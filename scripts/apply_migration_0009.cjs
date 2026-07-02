// Apply migration 0009 to the live Supabase instance via direct Postgres connection.
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// Try the pooler first, fall back to direct
const PASSWORD = "RestoPanel_Supa_2026!";
const REF = "cttemgwmabzuhrbqzpsg";
const CONNECTIONS = [
  `postgresql://postgres.${REF}:${PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${REF}:${PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${REF}:${PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${REF}:${PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${REF}:${PASSWORD}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${REF}:${PASSWORD}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres:${PASSWORD}@db.${REF}.supabase.co:5432/postgres`,
];

async function tryConnect(connStr) {
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  return client;
}

async function main() {
  const sqlPath = path.join(__dirname, "../supabase/migrations/0009_google_reviews.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  console.log("[apply] SQL length:", sql.length);

  let client;
  let lastErr;
  for (const conn of CONNECTIONS) {
    try {
      console.log("[apply] Trying connection:", conn.replace(/:[^:@]+@/, ":***@"));
      client = await tryConnect(conn);
      console.log("[apply] Connected.");
      break;
    } catch (e) {
      lastErr = e;
      console.log("[apply] Failed:", e.message);
    }
  }
  if (!client) {
    console.error("[apply] All connection attempts failed. Last error:", lastErr?.message);
    process.exit(1);
  }

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("[apply] Migration applied successfully.");

    const { rows } = await client.query(
      `select table_name from information_schema.tables where table_schema='public' and table_name in ('public_reviews','google_review_settings') order by table_name;`
    );
    console.log("[apply] Verified tables:", rows.map((r) => r.table_name));

    const { rows: policyRows } = await client.query(
      `select policyname from pg_policies where tablename='public_reviews' order by policyname;`
    );
    console.log("[apply] RLS policies:", policyRows.map((r) => r.policyname));
  } catch (err) {
    console.error("[apply] ERROR:", err.message);
    try { await client.query("ROLLBACK"); } catch (_) {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
