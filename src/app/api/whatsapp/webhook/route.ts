// ============================================================
// RestoPanel · WhatsApp Webhook Handler (Hardened)
// ============================================================
// GET  /api/whatsapp/webhook — Verification (Meta challenge)
// POST /api/whatsapp/webhook — Receive messages/status updates
//
// Security:
//   1. The verify token MUST be set via WHATSAPP_VERIFY_TOKEN env
//      var. No hardcoded defaults.
//   2. POST requests are HMAC-SHA256 verified using
//      WHATSAPP_APP_SECRET. Any request with an invalid signature
//      is rejected with 403 BEFORE any processing happens.
// ============================================================

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

// ─── GET: Webhook verification ────────────────────────────────
export async function GET(req: Request) {
  if (!VERIFY_TOKEN) {
    logger.error(
      "WHATSAPP_VERIFY_TOKEN no configurado — el webhook de WhatsApp no funcionará",
      "whatsapp-webhook"
    );
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    logger.info("Webhook de WhatsApp verificado correctamente", "whatsapp-webhook");
    return new NextResponse(challenge || "", { status: 200 });
  }

  logger.warn("Verificación de webhook de WhatsApp fallida", "whatsapp-webhook");
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── Verify HMAC-SHA256 signature from Meta ──────────────────
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!APP_SECRET || !signatureHeader) return false;

  // Format: "sha256=<hex>"
  const expected = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : null;
  if (!expected) return false;

  const hmac = createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");

  // Constant-time comparison to prevent timing attacks.
  if (expected.length !== hmac.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(hmac));
  } catch {
    return false;
  }
}

// ─── POST: Receive messages and status updates ───────────────
export async function POST(req: Request) {
  // Meta sends the body as raw JSON; we read it as text for HMAC
  // verification (must be byte-for-byte identical).
  const rawBody = await req.text();

  // ─── Signature verification (mandatory) ───────────────────
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature)) {
    logger.warn("Webhook de WhatsApp con firma inválida — rechazado", "whatsapp-webhook");
    return new NextResponse("Invalid signature", { status: 403 });
  }

  try {
    const body = JSON.parse(rawBody);

    // Meta sends a confirmation on first setup
    if (body.object) {
      // Process message webhooks
      if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from; // phone number
        const text = message.text?.body || "";
        // We no longer log message text — GDPR risk.
        logger.info(`Mensaje de WhatsApp recibido de ${from}`, "whatsapp-webhook");

        // Look up the customer by phone and store the inbound
        // message in the CRM (best-effort, non-blocking).
        try {
          const { data: customer } = await supabaseAdmin
            .from("customers")
            .select("id, organization_id, name")
            .eq("phone", from)
            .maybeSingle();

          if (customer) {
            await supabaseAdmin.from("whatsapp_messages").insert({
              organization_id: customer.organization_id,
              customer_id: customer.id,
              direction: "inbound",
              status: "received",
              message_text: text,
              wa_message_id: message.id,
              received_at: new Date(Number(message.timestamp) * 1000).toISOString(),
            });
          }
        } catch (e) {
          // Non-critical — don't fail the webhook.
          logger.warn("No se pudo persistir el mensaje de WhatsApp", "whatsapp-webhook", {
            error: (e as Error).message,
          });
        }
      }

      // Process status updates (sent, delivered, read)
      if (body.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]) {
        const status = body.entry[0].changes[0].value.statuses[0];
        logger.info(`Estado de WA: ${status.status} para ${status.id}`, "whatsapp-webhook");

        // Update the message status in the DB.
        try {
          await supabaseAdmin
            .from("whatsapp_messages")
            .update({ status: status.status })
            .eq("wa_message_id", status.id);
        } catch {
          // Non-critical.
        }
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false }, { status: 400 });
  } catch (e: any) {
    logger.error("Error en webhook de WhatsApp", "whatsapp-webhook", {
      error: e.message,
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
