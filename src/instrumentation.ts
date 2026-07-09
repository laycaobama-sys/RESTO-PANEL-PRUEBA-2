// ============================================================
// RestoPanel · Instrumentation Hook
// ============================================================
// This file is loaded ONCE when the Next.js server starts.
// We use it to start background processors that drain the email
// and WhatsApp queues.
//
// CRITICAL FIX: previously, startEmailProcessor() and
// startWhatsAppProcessor() were defined but NEVER called. Any
// transient Resend/Meta failure = permanent message loss because
// nothing picked up the queued rows after a retry window.
//
// In serverless environments (Vercel), this only runs in the
// Node.js runtime (not Edge). For true background processing at
// scale, use Vercel Cron + a dedicated worker. For now, this is
// sufficient for single-instance deployments.
// ============================================================

export async function register() {
  // Only run on the server (Node.js runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startEmailProcessor } = await import("@/lib/email-processor");
      startEmailProcessor();
      console.info("[instrumentation] Email processor started");
    } catch (e) {
      console.warn("[instrumentation] Email processor failed to start:", e);
    }

    try {
      const { startWhatsAppProcessor } = await import("@/lib/whatsapp");
      startWhatsAppProcessor();
      console.info("[instrumentation] WhatsApp processor started");
    } catch (e) {
      console.warn("[instrumentation] WhatsApp processor failed to start:", e);
    }
  }
}
