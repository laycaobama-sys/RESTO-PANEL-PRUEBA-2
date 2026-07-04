// Check Resend domain verification status
import fs from "fs";
import path from "path";

const envPath = path.join(import.meta.dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const API_KEY = process.env.RESEND_API_KEY;
const DOMAIN_ID = process.env.RESEND_DOMAIN_ID;

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Resend Domain Status                        ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  if (!DOMAIN_ID) {
    // List all domains
    const r = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const data = await r.json();
    if (data.data?.length === 0) {
      console.log("No domains registered. Creating restopanel.com...");
      const cr = await fetch("https://api.resend.com/domains", {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "restopanel.com", region: "us-east-1" }),
      });
      const cd = await cr.json();
      console.log("Created domain:", cd.id);
      console.log("\nDNS records needed:");
      for (const rec of cd.records) {
        console.log(`  ${rec.type} ${rec.name} = ${rec.value?.substring(0, 60)}...`);
      }
      return;
    }
    for (const d of data.data) {
      console.log(`Domain: ${d.name} | Status: ${d.status}`);
    }
    return;
  }

  // Check specific domain
  const r = await fetch(`https://api.resend.com/domains/${DOMAIN_ID}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const d = await r.json();

  console.log(`Domain: ${d.name}`);
  console.log(`Status: ${d.status}`);
  console.log(`\nDNS Records:`);
  for (const rec of d.records) {
    const status = rec.status === "verified" ? "✓" : "✗";
    console.log(`  ${status} ${rec.type} ${rec.name} = ${rec.value?.substring(0, 60)}...`);
  }

  if (d.status === "verified") {
    console.log("\n✓ Domain is verified! Emails can be sent to any recipient.");
  } else {
    console.log("\n✗ Domain is NOT verified yet.");
    console.log("  Add the DNS records above to your DNS provider.");
    console.log("  Then run: npm run verify:email");
  }
}
main().catch(console.error);
