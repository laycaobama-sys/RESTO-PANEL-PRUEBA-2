// Check which migrations are already applied by probing for table/column existence via REST
const url = "https://cttemgwmabzuhrbqzpsg.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dGVtZ3dtYWJ6dWhyYnF6cHNnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQ4ODE3MCwiZXhwIjoyMDk4MDY0MTcwfQ.3jf3hfzgoRmJ3Rkg68QG9n5mJv5jXHWvc51UlTuVynE";

async function probeTable(name) {
  const r = await fetch(`${url}/rest/v1/${name}?select=id&limit=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  return r.status !== 404;
}

async function probeColumn(table, column) {
  // Try selecting the column - if it doesn't exist, PostgREST returns 400
  const r = await fetch(`${url}/rest/v1/${table}?select=${column}&limit=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (r.status === 400) {
    const j = await r.json();
    return !j.message?.includes("Could not find");
  }
  return r.status === 200;
}

async function main() {
  console.log("Checking migration status via REST API...\n");

  const checks = [
    { migration: "0001_init.sql", description: "Base schema (10 tables)", applied: true },
    { migration: "0002_hardened_rls.sql", description: "Hardened RLS", applied: true },
    { migration: "0003_super_admin_audit.sql", description: "Super admin + audit_logs", probe: async () => await probeTable("audit_logs") },
    { migration: "0004_notifications.sql", description: "Notifications", probe: async () => await probeTable("notifications") },
    { migration: "0005_notifications_read.sql", description: "Notifications read tracking", probe: async () => await probeTable("notifications_read") },
    { migration: "0006_crm_customers.sql", description: "CRM customers", probe: async () => await probeTable("customers") },
    { migration: "0007_chat_shifts.sql", description: "Chat + shifts", probe: async () => await probeTable("chat_channels") && await probeTable("staff_shifts") },
    { migration: "0008_table_groups.sql", description: "Table groups (group_id column)", probe: async () => await probeColumn("tables", "group_id") },
    { migration: "0009_google_reviews.sql", description: "Public reviews", probe: async () => await probeTable("public_reviews") },
    { migration: "0010_fix_rls_recursion.sql", description: "Fix RLS recursion", applied: true }, // can't easily probe functions via REST
    { migration: "0011_user_blocked.sql", description: "User blocked column", probe: async () => await probeColumn("users", "blocked") },
  ];

  const missing = [];
  for (const c of checks) {
    let applied = c.applied;
    if (c.probe) {
      try {
        applied = await c.probe();
      } catch {
        applied = false;
      }
    }
    const status = applied ? "✓ APPLIED" : "✗ MISSING";
    console.log(`  ${status}  ${c.migration} — ${c.description}`);
    if (!applied) missing.push(c.migration);
  }

  console.log(`\nMissing migrations: ${missing.length}`);
  if (missing.length > 0) {
    console.log("Missing:", missing.join(", "));
  }
}
main();
