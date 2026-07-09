// ============================================================
// RestoPanel · Email Queue Processor
// ============================================================
// Background worker that processes queued emails.
// Runs every 10 seconds, picks up 'queued' emails,
// sends them via Resend, and updates status.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";
import { Resend } from "resend";
import { logger } from "@/lib/logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const PROCESS_INTERVAL = 10 * 1000; // 10 seconds
const MAX_BATCH = 10; // emails per cycle

let processorRunning = false;
let intervalHandle: NodeJS.Timeout | null = null;

export function startEmailProcessor() {
  if (intervalHandle) return;
  logger.info("Email queue processor started", "email-queue");
  intervalHandle = setInterval(processEmailQueue, PROCESS_INTERVAL);
  // Process immediately on start
  processEmailQueue().catch(() => {});
}

export function stopEmailProcessor() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info("Email queue processor stopped", "email-queue");
  }
}

async function processEmailQueue() {
  if (processorRunning) return;
  processorRunning = true;

  try {
    // Get queued emails
    const { data: queuedEmails, error } = await supabaseAdmin
      .from("email_queue")
      .select("*")
      .eq("status", "queued")
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(MAX_BATCH);

    if (error || !queuedEmails || queuedEmails.length === 0) {
      return;
    }

    logger.info(`Processing ${queuedEmails.length} queued emails`, "email-queue");

    for (const email of queuedEmails) {
      await processSingleEmail(email);
    }
  } catch (e: any) {
    logger.error("Email queue processing error", "email-queue", { error: e.message });
  } finally {
    processorRunning = false;
  }
}

async function processSingleEmail(email: any) {
  // Mark as sending
  await supabaseAdmin
    .from("email_queue")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", email.id);

  try {
    if (!RESEND_API_KEY) {
      // No API key — mark as failed
      await supabaseAdmin
        .from("email_queue")
        .update({
          status: "failed",
          last_error: "RESEND_API_KEY not configured",
          updated_at: new Date().toISOString(),
        })
        .eq("id", email.id);
      return;
    }

    const resend = new Resend(RESEND_API_KEY);
    const { data, error: sendError } = await resend.emails.send({
      from: email.from_email,
      to: email.to_email.split(","),
      subject: email.subject,
      html: email.html_body,
      text: email.text_body,
    });

    if (sendError) {
      throw new Error(sendError.message);
    }

    // Success — mark as delivered
    await supabaseAdmin
      .from("email_queue")
      .update({
        status: "delivered",
        resend_id: data?.id,
        attempts: email.attempts + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", email.id);

    logger.info(`Email delivered: ${email.subject} → ${email.to_email}`, "email-queue", { id: email.id, resendId: data?.id });
  } catch (e: any) {
    // Failed — increment attempts, schedule retry or mark as failed
    const attempts = email.attempts + 1;
    const maxAttempts = email.max_attempts || 5;

    if (attempts >= maxAttempts) {
      await supabaseAdmin
        .from("email_queue")
        .update({
          status: "failed",
          attempts,
          last_error: e.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", email.id);

      logger.error(`Email permanently failed after ${attempts} attempts`, "email-queue", {
        id: email.id,
        error: e.message,
      });
    } else {
      // Schedule retry with exponential backoff
      const delay = Math.pow(2, attempts) * 1000; // 2s, 4s, 8s, 16s, 32s
      const nextAttempt = new Date(Date.now() + delay).toISOString();

      await supabaseAdmin
        .from("email_queue")
        .update({
          status: "queued",
          attempts,
          last_error: e.message,
          next_attempt_at: nextAttempt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", email.id);

      logger.warn(`Email retry ${attempts}/${maxAttempts} scheduled`, "email-queue", {
        id: email.id,
        nextAttempt,
        error: e.message,
      });
    }
  }
}

// ─── Get queue stats ─────────────────────────────────────────
export async function getQueueStats() {
  try {
    const { data, error } = await supabaseAdmin
      .from("email_queue")
      .select("status")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) return { queued: 0, sending: 0, delivered: 0, failed: 0, total: 0 };

    const stats = {
      queued: 0,
      sending: 0,
      delivered: 0,
      failed: 0,
      total: data.length,
    };

    for (const item of data) {
      if (stats[item.status as keyof typeof stats] !== undefined) {
        (stats[item.status as keyof typeof stats] as number)++;
      }
    }

    return stats;
  } catch {
    return { queued: 0, sending: 0, delivered: 0, failed: 0, total: 0 };
  }
}
