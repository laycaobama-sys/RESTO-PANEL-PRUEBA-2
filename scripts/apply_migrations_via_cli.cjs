const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Load .env
const envPath = path.join(__dirname, "../.env");
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

const REF = process.env.SUPABASE_PROJECT_REF || "cttemgwmabzuhrbqzpsg";
const PASSWORD = process.env.SUPABASE_DB_PASSWORD || "RestoPanel_Supa_2026!";

// Try all pooler regions
const hosts = [
  "aws-0-eu-west-1.pooler.supabase.com",
  "aws-0-eu-central-1.pooler.supabase.com",
  "aws-0-us-east-1.pooler.supabase.com",
];

async function main() {
  for (const host of hosts) {
    const connStr = `postgresql://postgres.${REF}:${encodeURIComponent(PASSWORD)}@${host}:5432/postgres`;
    console.log(`Trying ${host}...`);
    try {
      // Use supabase CLI to execute SQL
      const sql = fs.readFileSync(path.join(__dirname, "apply-missing-migrations.sql"), "utf8");
      const result = execSync(
        `npx supabase db execute --connection-string "${connStr}"`,
        { input: sql, encoding: "utf8", timeout: 30000 }
      );
      console.log("✓ Migrations applied via", host);
      console.log(result);
      return;
    } catch (e) {
      console.log(`  Failed: ${e.message.substring(0, 80)}`);
    }
  }
  console.log("Could not apply migrations via CLI");
}
main();
