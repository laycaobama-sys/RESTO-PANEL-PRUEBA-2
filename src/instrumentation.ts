// ============================================================
// RestoPanel · Instrumentation Hook
// ============================================================
// CRÍTICO: Este archivo se ejecuta en Edge Runtime durante el
// build de Next.js. Solo debemos arrancar los processors en
// Node.js runtime, no en Edge. Usamos una verificación estricta.
// ============================================================

export async function register() {
  // Solo ejecutar en Node.js runtime (no Edge, no build)
  // NEXT_RUNTIME === 'nodejs' solo está disponible en runtime
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  // Email processor
  try {
    const { startEmailProcessor } = await import("@/lib/email-processor");
    if (typeof startEmailProcessor === "function") {
      startEmailProcessor();
      console.info("[instrumentation] Email processor started");
    }
  } catch (e: any) {
    console.warn("[instrumentation] Email processor failed to start:", e?.message || String(e));
  }

  // WhatsApp processor
  try {
    const { startWhatsAppProcessor } = await import("@/lib/whatsapp");
    if (typeof startWhatsAppProcessor === "function") {
      startWhatsAppProcessor();
      console.info("[instrumentation] WhatsApp processor started");
    }
  } catch (e: any) {
    console.warn("[instrumentation] WhatsApp processor failed to start:", e?.message || String(e));
  }
}
