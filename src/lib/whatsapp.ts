// ============================================================
// RestoPanel · WhatsApp Service
// ============================================================
// Complete WhatsApp Business infrastructure.
//
// Uses the WhatsApp Cloud API (Meta Graph API). To activate
// real sending, the user needs:
//   1. A Meta Business Account
//   2. A WhatsApp Business phone number
//   3. A permanent access token (WHATSAPP_TOKEN env var)
//   4. The phone number ID (WHATSAPP_PHONE_NUMBER_ID env var)
//   5. Verified template messages for production use
//
// Until those are configured, the service:
//   - Logs every message to the DB (whatsapp_messages table)
//   - Logs to console in dev mode
//   - Tracks delivery status
//   - Supports retries with exponential backoff
//
// Templates are pre-approved text patterns that WhatsApp
// requires for business-initiated messages. For user-initiated
// conversations (within 24h of customer message), free-text
// is allowed.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

// ─── Template registry ────────────────────────────────────────
// Pre-defined message templates. These need to be approved in
// the Meta Business Manager before they can be sent to users
// outside the 24h window. The names here must match the names
// registered in Meta.
export interface WhatsAppTemplate {
  name: string;
  language: { code: string };
  components?: any[];
}

export const whatsappTemplates = {
  // Reservation confirmation (customer-initiated, so free text works
  // if within 24h — otherwise needs Meta-approved template)
  reservationConfirmation: (data: {
    restaurantName: string;
    date: string;
    time: string;
    partySize: number;
  }): { text: string; template?: WhatsAppTemplate } => ({
    text: `¡Hola! Tu reserva en *${data.restaurantName}* está confirmada.\n\n📅 ${data.date}\n🕐 ${data.time}\n👥 ${data.partySize} personas\n\nTe esperamos. Para cancelar, responde a este mensaje.`,
    // If outside 24h window, use the approved template instead:
    template: {
      name: "reservation_confirmation",
      language: { code: "es" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: data.restaurantName },
            { type: "text", text: data.date },
            { type: "text", text: data.time },
            { type: "text", text: String(data.partySize) },
          ],
        },
      ],
    },
  }),

  // Reservation reminder (24h before)
  reservationReminder: (data: {
    restaurantName: string;
    date: string;
    time: string;
  }): { text: string; template?: WhatsAppTemplate } => ({
    text: `Te recordamos tu reserva en *${data.restaurantName}*.\n\n📅 ${data.date}\n🕐 ${data.time}\n\n¡Te esperamos!`,
    template: {
      name: "reservation_reminder",
      language: { code: "es" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: data.restaurantName },
            { type: "text", text: data.date },
            { type: "text", text: data.time },
          ],
        },
      ],
    },
  }),

  // No-show warning
  noShowWarning: (data: {
    restaurantName: string;
    customerName: string;
  }): { text: string; template?: WhatsAppTemplate } => ({
    text: `Hola ${data.customerName}, lamentamos que no hayas podido venir a ${data.restaurantName}. Si quieres reagendar, escríbenos. ¡Te esperamos pronto!`,
  }),

  // Custom message (free text, only within 24h window)
  custom: (text: string): { text: string } => ({ text }),
};

// ─── Message queue (in-memory, processes via setInterval) ────
interface QueuedMessage {
  id: string;
  to: string;
  text?: string;
  template?: WhatsAppTemplate;
  organizationId: string;
  type: string;
  refId?: string; // reservation id, customer id, etc.
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
}

const queue: QueuedMessage[] = [];
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 5000; // 5s, 10s, 20s

let processorRunning = false;

// ─── DB persistence (best-effort) ─────────────────────────────
async function logMessageToDb(msg: QueuedMessage, status: string, error?: string, whatsappMessageId?: string) {
  try {
    await supabaseAdmin.from("whatsapp_messages").upsert({
      id: msg.id,
      organization_id: msg.organizationId,
      to_phone: msg.to,
      body: msg.text || JSON.stringify(msg.template),
      type: msg.type,
      ref_id: msg.refId,
      status,
      attempts: msg.attempts,
      error,
      whatsapp_message_id: whatsappMessageId,
      next_attempt_at: new Date(msg.nextAttemptAt).toISOString(),
      created_at: new Date(msg.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    console.warn("[whatsapp] Failed to log to DB:", e.message);
  }
}

// ─── Send via WhatsApp Cloud API ──────────────────────────────
async function sendViaWhatsAppAPI(to: string, text?: string, template?: WhatsAppTemplate): Promise<{ messageId?: string; error?: string }> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return { error: "WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured" };
  }

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const body: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.replace(/[^0-9]/g, ""),
  };

  if (template) {
    body.type = "template";
    body.template = template;
  } else if (text) {
    body.type = "text";
    body.text = { body: text };
  }

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return { error: data.error?.message || `HTTP ${resp.status}` };
    }

    return { messageId: data.messages?.[0]?.id };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ─── Queue processor ──────────────────────────────────────────
async function processQueue() {
  if (processorRunning) return;
  processorRunning = true;

  try {
    const now = Date.now();
    const ready = queue.filter((m) => m.nextAttemptAt <= now && m.attempts < MAX_ATTEMPTS);

    for (const msg of ready) {
      msg.attempts += 1;

      // Try to send
      const result = await sendViaWhatsAppAPI(msg.to, msg.text, msg.template);

      if (result.messageId) {
        // Success — remove from queue
        const idx = queue.indexOf(msg);
        if (idx > -1) queue.splice(idx, 1);
        await logMessageToDb(msg, "sent", undefined, result.messageId);
        console.log(`[whatsapp] ✓ Sent to ${msg.to} (attempt ${msg.attempts})`);
      } else {
        // Failed — schedule retry or mark as failed
        if (msg.attempts >= MAX_ATTEMPTS) {
          const idx = queue.indexOf(msg);
          if (idx > -1) queue.splice(idx, 1);
          await logMessageToDb(msg, "failed", result.error);
          console.error(`[whatsapp] ✗ Failed to send to ${msg.to} after ${MAX_ATTEMPTS} attempts: ${result.error}`);
        } else {
          msg.nextAttemptAt = now + BASE_DELAY_MS * Math.pow(2, msg.attempts - 1);
          await logMessageToDb(msg, "retrying", result.error);
          console.warn(`[whatsapp] ⚠ Attempt ${msg.attempts} failed for ${msg.to}, retrying: ${result.error}`);
        }
      }
    }
  } finally {
    processorRunning = false;
  }
}

// Start the queue processor (every 10 seconds)
let intervalHandle: NodeJS.Timeout | null = null;
export function startWhatsAppProcessor() {
  if (intervalHandle) return;
  if (!WHATSAPP_TOKEN) {
    console.log("[whatsapp] WHATSAPP_TOKEN not set — running in dev/log mode");
  }
  intervalHandle = setInterval(processQueue, 10000);
  console.log("[whatsapp] Queue processor started (10s interval)");
}

export function stopWhatsAppProcessor() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

// ─── Public API ───────────────────────────────────────────────
export interface SendWhatsAppOptions {
  to: string; // E.164 format: +34600000000
  text?: string;
  template?: WhatsAppTemplate;
  organizationId: string;
  type: string; // "reservation_confirmation", "reminder", etc.
  refId?: string;
}

export async function sendWhatsApp(opts: SendWhatsAppOptions): Promise<{ queued: boolean; messageId: string }> {
  const id = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const msg: QueuedMessage = {
    id,
    to: opts.to,
    text: opts.text,
    template: opts.template,
    organizationId: opts.organizationId,
    type: opts.type,
    refId: opts.refId,
    attempts: 0,
    nextAttemptAt: Date.now(),
    createdAt: Date.now(),
  };

  queue.push(msg);
  await logMessageToDb(msg, "queued");

  // Try to process immediately
  processQueue().catch(() => {});

  return { queued: true, messageId: id };
}

// ─── Convenience: send reservation confirmation ───────────────
export async function sendReservationConfirmation(opts: {
  to: string;
  organizationId: string;
  reservationId: string;
  restaurantName: string;
  date: string;
  time: string;
  partySize: number;
}) {
  const tpl = whatsappTemplates.reservationConfirmation({
    restaurantName: opts.restaurantName,
    date: opts.date,
    time: opts.time,
    partySize: opts.partySize,
  });

  return sendWhatsApp({
    to: opts.to,
    text: tpl.text,
    template: tpl.template,
    organizationId: opts.organizationId,
    type: "reservation_confirmation",
    refId: opts.reservationId,
  });
}

// ─── Convenience: send reminder ───────────────────────────────
export async function sendReservationReminder(opts: {
  to: string;
  organizationId: string;
  reservationId: string;
  restaurantName: string;
  date: string;
  time: string;
}) {
  const tpl = whatsappTemplates.reservationReminder({
    restaurantName: opts.restaurantName,
    date: opts.date,
    time: opts.time,
  });

  return sendWhatsApp({
    to: opts.to,
    text: tpl.text,
    template: tpl.template,
    organizationId: opts.organizationId,
    type: "reservation_reminder",
    refId: opts.reservationId,
  });
}

// ─── Get queue status (for admin UI) ──────────────────────────
export function getWhatsAppQueueStatus() {
  return {
    queued: queue.filter((m) => m.attempts === 0).length,
    retrying: queue.filter((m) => m.attempts > 0 && m.attempts < MAX_ATTEMPTS).length,
    total: queue.length,
    isConfigured: !!(WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID),
  };
}
