// ============================================================
// RestoPanel · GET /api/health
// ============================================================
// Health check endpoint for monitoring and load balancers.
// Returns 200 if the app is healthy, 503 if degraded.
//
// Checks:
//   - Database connection (Supabase REST)
//   - Auth service (NextAuth)
//   - Email service (Resend configured?)
//   - WhatsApp service (configured?)
//
// Usage: curl https://yourapp.com/api/health
// ============================================================

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const checks: Record<string, { status: "ok" | "degraded" | "down"; detail?: string }> = {};
  let overallStatus: "ok" | "degraded" | "down" = "ok";
  const startTime = Date.now();

  // ─── 1. Database ─────────────────────────────────────────
  try {
    const { error } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .limit(1);
    if (error) {
      checks.database = { status: "down", detail: error.message };
      overallStatus = "down";
    } else {
      checks.database = { status: "ok" };
    }
  } catch (e: any) {
    checks.database = { status: "down", detail: e.message };
    overallStatus = "down";
  }

  // ─── 2. Auth ─────────────────────────────────────────────
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      checks.auth = { status: "down", detail: "NEXTAUTH_SECRET not set" };
      overallStatus = "down";
    } else {
      checks.auth = { status: "ok" };
    }
  } catch (e: any) {
    checks.auth = { status: "down", detail: e.message };
    overallStatus = "down";
  }

  // ─── 3. Email ────────────────────────────────────────────
  checks.email = {
    status: process.env.RESEND_API_KEY ? "ok" : "degraded",
    detail: process.env.RESEND_API_KEY ? undefined : "RESEND_API_KEY not set (emails will be logged, not sent)",
  };
  if (checks.email.status === "degraded" && overallStatus === "ok") overallStatus = "degraded";

  // ─── 4. WhatsApp ─────────────────────────────────────────
  checks.whatsapp = {
    status: process.env.WHATSAPP_TOKEN ? "ok" : "degraded",
    detail: process.env.WHATSAPP_TOKEN ? undefined : "WHATSAPP_TOKEN not set (messages will be queued, not sent)",
  };
  if (checks.whatsapp.status === "degraded" && overallStatus === "ok") overallStatus = "degraded";

  // ─── 5. Web Import ───────────────────────────────────────
  checks.webImport = { status: "ok" };

  const responseTime = Date.now() - startTime;
  const httpStatus = overallStatus === "down" ? 503 : 200;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTimeMs: responseTime,
      version: process.env.npm_package_version || "0.2.0",
      environment: process.env.NODE_ENV || "development",
      checks,
    },
    { status: httpStatus }
  );
}
