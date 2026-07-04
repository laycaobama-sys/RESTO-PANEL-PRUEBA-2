// ============================================================
// RestoPanel · WhatsApp Webhook Handler
// ============================================================
// GET  /api/whatsapp/webhook — Verification (Meta challenge)
// POST /api/whatsapp/webhook — Receive messages/status updates
//
// Meta requires this endpoint to:
//   1. Respond to GET with the hub.challenge value
//   2. Accept POST with message/status webhooks
//
// Configure the webhook URL in Meta Business Manager:
//   https://business.facebook.com → WhatsApp Manager → Configuration
//   Webhook URL: https://yourdomain.com/api/whatsapp/webhook
//   Verify Token: WHATSAPP_VERIFY_TOKEN (set in .env)
// ============================================================

import { NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "restopanel_verify_2026";

// ─── GET: Webhook verification ────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.info("[whatsapp] Webhook verified successfully");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[whatsapp] Webhook verification failed");
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST: Receive messages and status updates ───────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Log the webhook for debugging
    console.info("[whatsapp] Webhook received:", JSON.stringify(body).substring(0, 500));

    // Meta sends a confirmation on first setup
    if (body.object) {
      // Process message webhooks
      if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from; // phone number
        const text = message.text?.body || "";
        const timestamp = message.timestamp;

        console.info(`[whatsapp] Message from ${from}: ${text.substring(0, 100)}`);

        // Here we would:
        // 1. Look up the customer by phone number
        // 2. Store the message in the CRM
        // 3. Trigger auto-replies if configured
        // For now, we just acknowledge receipt
      }

      // Process status updates (sent, delivered, read)
      if (body.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]) {
        const status = body.entry[0].changes[0].value.statuses[0];
        console.info(`[whatsapp] Status: ${status.status} for ${status.id}`);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false }, { status: 400 });
  } catch (e: any) {
    console.error("[whatsapp] Webhook error:", e.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
