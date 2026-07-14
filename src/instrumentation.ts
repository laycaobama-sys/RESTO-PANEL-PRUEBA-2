// ============================================================
// RestoPanel · Instrumentation Hook
// ============================================================
// This file is loaded ONCE when the Next.js server starts.
// We use it to start background processors that drain the email
// and WhatsApp queues.
//
// CRITICAL: If ANY processor fails to start, the server must
// still boot. We wrap everything in try/catch and log warnings.
// ============================================================

export async function register() {
  // Only run on the server (Node.js runtime), not during build
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NODE_ENV === "development") {
    // Email processor
    try {
      const { startEmailProcessor } = await import("@/lib/email-processor");
      if (typeof startEmailProcessor === "function") {
        startEmailProcessor();
        console.info("[instrumentation] Email processor started");
      }
    } catch (e: any) {
      console.warn("[instrumentation] Email processor failed to start:", e?.message || e);
    }

    // WhatsApp processor
    try {
      const { startWhatsAppProcessor } = await import("@/lib/whatsapp");
      if (typeof startWhatsAppProcessor === "function") {
        startWhatsAppProcessor();
        console.info("[instrumentation] WhatsApp processor started");
      }
    } catch (e: any) {
      console.warn("[instrumentation] WhatsApp processor failed to start:", e?.message || e);
    }
  }
}
