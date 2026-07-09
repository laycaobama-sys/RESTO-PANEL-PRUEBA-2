import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getQueueStats } from "@/lib/email-processor";

export async function GET() {
  const checks: Record<string, { status: string; latency_ms?: number; detail?: string }> = {};
  let allOk = true;

  // Database
  const dbStart = Date.now();
  try {
    const { error } = await supabaseAdmin.from("organizations").select("id").limit(1);
    checks.database = { status: error ? "error" : "ok", latency_ms: Date.now() - dbStart };
    if (error) allOk = false;
  } catch (e: any) {
    checks.database = { status: "error", detail: e.message };
    allOk = false;
  }

  // Supabase URL
  checks.supabase = { status: process.env.NEXT_PUBLIC_SUPABASE_URL ? "ok" : "error" };

  // Resend
  const resendStart = Date.now();
  try {
    const r = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    checks.resend = { status: r.ok ? "ok" : "error", latency_ms: Date.now() - resendStart };
    if (!r.ok) allOk = false;
  } catch (e: any) {
    checks.resend = { status: "error", detail: e.message };
    allOk = false;
  }

  // WhatsApp
  checks.whatsapp = {
    status: process.env.WHATSAPP_TOKEN ? "ok" : "not_configured",
    detail: process.env.WHATSAPP_TOKEN ? undefined : "Token no configurado",
  };

  // Cloudflare
  checks.cloudflare = {
    status: process.env.CLOUDFLARE_API_TOKEN ? "ok" : "not_configured",
  };

  // Email queue
  try {
    const queueStats = await getQueueStats();
    checks.email_queue = { status: "ok", detail: `${queueStats.queued} queued, ${queueStats.failed} failed` };
  } catch {
    checks.email_queue = { status: "unknown" };
  }

  // Version
  checks.version = { status: process.env.npm_package_version || "0.2.0" };

  return NextResponse.json({
    overall: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  });
}
