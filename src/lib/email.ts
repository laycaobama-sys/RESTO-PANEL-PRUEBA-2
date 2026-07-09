// ============================================================
// RestoPanel · Email Service
// ============================================================
// Production-ready email system using Resend.
//
// Features:
//   - HTML + text templates for every email type
//   - Retry with exponential backoff (3 attempts)
//   - Error logging to console + audit_logs
//   - Graceful degradation: if RESEND_API_KEY is not set,
//     emails are logged but not sent (dev mode)
//   - All templates are inline-styled for email client compat
//
// Usage:
//   import { sendEmail, emailTemplates } from "@/lib/email";
//   await sendEmail({
//     to: "user@example.com",
//     subject: "Bienvenido",
//     template: emailTemplates.welcome({ name: "Carmen" }),
//   });
// ============================================================

import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/admin";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "RestoPanel <noreply@restopanel.com>";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

// Lazy-init the Resend client so the module doesn't crash if the key
// is missing in dev — we just log the email instead.
let _client: Resend | null = null;
function getClient(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!_client) _client = new Resend(RESEND_API_KEY);
  return _client;
}

export interface EmailTemplate {
  html: string;
  text: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  template: EmailTemplate;
  replyTo?: string;
  // Internal
  _attempt?: number;
}

export interface EmailLog {
  to: string | string[];
  subject: string;
  status: "queued" | "sending" | "delivered" | "bounced" | "failed" | "dev_logged";
  attempt: number;
  error?: string;
  messageId?: string;
  sentAt: string;
}

// ─── Retry logic ──────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 2000; // 2s, 4s, 8s, 16s, 32s

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Email queue persistence ──────────────────────────────────
// When Resend fails, the email is saved to the email_queue table
// for automatic retry. This ensures no email is ever lost.
async function queueEmail(opts: SendEmailOptions, error?: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    await supabaseAdmin.from("email_queue").insert({
      to_email: Array.isArray(opts.to) ? opts.to.join(",") : opts.to,
      subject: opts.subject,
      html_body: opts.template.html,
      text_body: opts.template.text,
      from_email: FROM_EMAIL,
      status: "queued",
      attempts: 0,
      max_attempts: MAX_ATTEMPTS,
      next_attempt_at: new Date(Date.now() + BASE_DELAY_MS).toISOString(),
      last_error: error || null,
      organization_id: (opts as any).organizationId || null,
    });
  } catch {
    // Queue table might not exist — non-critical
  }
}

// ─── Main send function ───────────────────────────────────────
export async function sendEmail(opts: SendEmailOptions): Promise<EmailLog> {
  const attempt = opts._attempt || 1;
  const sentAt = new Date().toISOString();

  // Dev mode: no API key, just log
  if (!RESEND_API_KEY) {
    console.log(`\n📧 [EMAIL · DEV MODE] ──────────────────────`);
    console.log(`  To: ${Array.isArray(opts.to) ? opts.to.join(", ") : opts.to}`);
    console.log(`  Subject: ${opts.subject}`);
    console.log(`  From: ${FROM_EMAIL}`);
    console.log(`  ─── Text body ───`);
    console.log(opts.template.text.substring(0, 200) + "...");
    console.log(`  ──────────────────\n`);

    return {
      to: opts.to,
      subject: opts.subject,
      status: "dev_logged",
      attempt,
      sentAt,
    };
  }

  const client = getClient();
  if (!client) {
    // Queue for retry
    await queueEmail(opts, "Resend client not initialized");
    return {
      to: opts.to,
      subject: opts.subject,
      status: "queued",
      attempt,
      error: "Resend client not initialized — queued for retry",
      sentAt,
    };
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: opts.subject,
      html: opts.template.html,
      text: opts.template.text,
      replyTo: opts.replyTo,
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      to: opts.to,
      subject: opts.subject,
      status: "delivered",
      attempt,
      messageId: data?.id,
      sentAt,
    };
  } catch (err: any) {
    // Retry with exponential backoff
    if (attempt < MAX_ATTEMPTS) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`[email] Attempt ${attempt} failed, retrying in ${delay}ms: ${err.message}`);
      await sleep(delay);
      return sendEmail({ ...opts, _attempt: attempt + 1 });
    }

    // Final failure — queue for later retry
    console.error(`[email] All ${MAX_ATTEMPTS} attempts failed: ${err.message}`);
    await queueEmail(opts, err.message);
    return {
      to: opts.to,
      subject: opts.subject,
      status: "queued",
      attempt,
      error: `All ${MAX_ATTEMPTS} attempts failed — queued for later retry: ${err.message}`,
      sentAt,
    };
  }
}

// ─── Email templates ──────────────────────────────────────────
// All templates use inline styles for maximum email client compat.
// Colors match the brand: dark bg #0a0a0a, gold accent #C5A059.

const WRAPPER = (content: string, previewText: string) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RestoPanel</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f5f5f0;">
  <div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111518;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px;background:linear-gradient(135deg,rgba(197,160,89,0.15),transparent);border-bottom:1px solid rgba(255,255,255,0.06);">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="display:inline-block;width:32px;height:32px;background:linear-gradient(135deg,#C5A059,#9a7d3e);border-radius:8px;text-align:center;line-height:32px;color:#0a0a0a;font-weight:bold;font-size:16px;">R</div>
                  </td>
                  <td style="vertical-align:middle;padding-left:10px;">
                    <span style="font-size:18px;font-weight:600;color:#f5f5f0;letter-spacing:-0.5px;">Resto<span style="color:#C5A059;">Panel</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);background:#0a0a0a;">
              <p style="margin:0;font-size:12px;color:#525252;line-height:1.5;">
                © ${new Date().getFullYear()} RestoPanel · Software de gestión para restaurantes<br>
                Este email se envió desde ${APP_URL}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const BUTTON = (text: string, href: string) => `
  <a href="${href}" style="display:inline-block;padding:12px 28px;background:#C5A059;color:#0a0a0a;font-weight:600;font-size:14px;border-radius:8px;text-decoration:none;margin:16px 0;">${text}</a>
`;

export const emailTemplates = {
  // ─── Welcome (after registration) ─────────────────────────
  welcome({ name, restaurantName, loginUrl }: { name: string; restaurantName: string; loginUrl: string }): EmailTemplate {
    const html = WRAPPER(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f5f5f0;">¡Bienvenido a RestoPanel, ${name}! 👋</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#a1a1aa;">
        Tu restaurante <strong style="color:#C5A059;">${restaurantName}</strong> ya está creado y listo para empezar.
        Hemos configurado tu espacio de trabajo con todo lo que necesitas para gestionar reservas, mesas, clientes y carta.
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#a1a1aa;">Próximos pasos recomendados:</p>
      <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#a1a1aa;line-height:1.8;">
        <li>Configura tu plano de mesas</li>
        <li>Añade los platos de tu carta</li>
        <li>Personaliza tu página pública de reservas</li>
        <li>Importa tu web actual (Ajustes → Importar web)</li>
      </ul>
      ${BUTTON("Entrar a mi panel", loginUrl)}
      <p style="margin:24px 0 0;font-size:13px;color:#525252;">Si no creaste esta cuenta, puedes ignorar este email.</p>
    `, `Bienvenido a RestoPanel, ${name}`);

    const text = `¡Bienvenido a RestoPanel, ${name}!

Tu restaurante ${restaurantName} ya está creado y listo para empezar.

Entra a tu panel: ${loginUrl}

© ${new Date().getFullYear()} RestoPanel`;

    return { html, text };
  },

  // ─── Password reset ────────────────────────────────────────
  passwordReset({ name, resetUrl, expiresIn = "1 hora" }: { name: string; resetUrl: string; expiresIn?: string }): EmailTemplate {
    const html = WRAPPER(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f5f5f0;">Recuperación de contraseña</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#a1a1aa;">
        Hola ${name}, hemos recibido una solicitud para restablecer tu contraseña de RestoPanel.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#a1a1aa;">
        Haz clic en el botón para crear una nueva contraseña. El enlace expira en <strong style="color:#C5A059;">${expiresIn}</strong>.
      </p>
      ${BUTTON("Restablecer contraseña", resetUrl)}
      <p style="margin:24px 0 0;font-size:13px;color:#525252;">Si no solicitaste este cambio, ignora este email. Tu contraseña seguirá siendo la misma.</p>
    `, `Recuperación de contraseña para ${name}`);

    const text = `Recuperación de contraseña

Hola ${name},

Restablece tu contraseña en este enlace (expira en ${expiresIn}):
${resetUrl}

Si no lo solicitaste, ignora este email.

© ${new Date().getFullYear()} RestoPanel`;

    return { html, text };
  },

  // ─── Email verification ────────────────────────────────────
  emailVerification({ name, verifyUrl }: { name: string; verifyUrl: string }): EmailTemplate {
    const html = WRAPPER(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f5f5f0;">Verifica tu email</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#a1a1aa;">
        Hola ${name}, confirma tu dirección de email para completar tu registro en RestoPanel.
      </p>
      ${BUTTON("Verificar email", verifyUrl)}
      <p style="margin:24px 0 0;font-size:13px;color:#525252;">O copia este enlace: ${verifyUrl}</p>
    `, `Verifica tu email en RestoPanel`);

    const text = `Verifica tu email

Hola ${name},

Confirma tu email en este enlace:
${verifyUrl}

© ${new Date().getFullYear()} RestoPanel`;

    return { html, text };
  },

  // ─── Reservation confirmation (to customer) ───────────────
  reservationConfirmation({
    customerName,
    restaurantName,
    date,
    time,
    partySize,
    zone,
    cancelUrl,
  }: {
    customerName: string;
    restaurantName: string;
    date: string;
    time: string;
    partySize: number;
    zone?: string;
    cancelUrl?: string;
  }): EmailTemplate {
    const html = WRAPPER(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f5f5f0;">Reserva confirmada ✅</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#a1a1aa;">
        Hola ${customerName}, tu reserva en <strong style="color:#C5A059;">${restaurantName}</strong> está confirmada.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:8px;padding:20px;margin-bottom:24px;">
        <tr><td style="font-size:13px;color:#525252;padding-bottom:8px;">Fecha</td><td style="font-size:14px;color:#f5f5f0;font-weight:600;text-align:right;">${date}</td></tr>
        <tr><td style="font-size:13px;color:#525252;padding-bottom:8px;">Hora</td><td style="font-size:14px;color:#f5f5f0;font-weight:600;text-align:right;">${time}</td></tr>
        <tr><td style="font-size:13px;color:#525252;padding-bottom:8px;">Comensales</td><td style="font-size:14px;color:#f5f5f0;font-weight:600;text-align:right;">${partySize} personas</td></tr>
        ${zone ? `<tr><td style="font-size:13px;color:#525252;">Zona</td><td style="font-size:14px;color:#f5f5f0;font-weight:600;text-align:right;">${zone}</td></tr>` : ""}
      </table>
      <p style="margin:0;font-size:14px;color:#a1a1aa;">Te esperamos. Si necesitas cancelar o modificar tu reserva, contáctanos.</p>
      ${cancelUrl ? BUTTON("Cancelar reserva", cancelUrl) : ""}
    `, `Reserva confirmada en ${restaurantName}`);

    const text = `Reserva confirmada

Hola ${customerName},

Tu reserva en ${restaurantName} está confirmada:
- Fecha: ${date}
- Hora: ${time}
- Comensales: ${partySize}
${zone ? `- Zona: ${zone}\n` : ""}Te esperamos.

© ${new Date().getFullYear()} RestoPanel`;

    return { html, text };
  },

  // ─── Reservation reminder (sent before the reservation) ───
  reservationReminder({
    customerName,
    restaurantName,
    date,
    time,
    partySize,
  }: {
    customerName: string;
    restaurantName: string;
    date: string;
    time: string;
    partySize: number;
  }): EmailTemplate {
    const html = WRAPPER(`
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#f5f5f0;">Tu reserva es mañana 📅</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#a1a1aa;">
        Hola ${customerName}, te recordamos tu reserva en <strong style="color:#C5A059;">${restaurantName}</strong>.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:8px;padding:20px;margin-bottom:24px;">
        <tr><td style="font-size:13px;color:#525252;padding-bottom:8px;">Fecha</td><td style="font-size:14px;color:#f5f5f0;font-weight:600;text-align:right;">${date}</td></tr>
        <tr><td style="font-size:13px;color:#525252;padding-bottom:8px;">Hora</td><td style="font-size:14px;color:#f5f5f0;font-weight:600;text-align:right;">${time}</td></tr>
        <tr><td style="font-size:13px;color:#525252;">Comensales</td><td style="font-size:14px;color:#f5f5f0;font-weight:600;text-align:right;">${partySize} personas</td></tr>
      </table>
      <p style="margin:0;font-size:14px;color:#a1a1aa;">Si no puedes venir, avísanos con la mayor antelación posible.</p>
    `, `Recordatorio: reserva en ${restaurantName} mañana`);

    const text = `Recordatorio de reserva

Hola ${customerName},

Te recordamos tu reserva en ${restaurantName}:
- Fecha: ${date}
- Hora: ${time}
- Comensales: ${partySize}

Te esperamos.

© ${new Date().getFullYear()} RestoPanel`;

    return { html, text };
  },

  // ─── Notification to restaurant staff ──────────────────────
  staffNotification({
    title,
    message,
    dashboardUrl,
  }: {
    title: string;
    message: string;
    dashboardUrl?: string;
  }): EmailTemplate {
    const html = WRAPPER(`
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#f5f5f0;">${title}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#a1a1aa;">${message}</p>
      ${dashboardUrl ? BUTTON("Ver en el panel", dashboardUrl) : ""}
    `, title);

    const text = `${title}

${message}

${dashboardUrl ? `Ver en el panel: ${dashboardUrl}` : ""}

© ${new Date().getFullYear()} RestoPanel`;

    return { html, text };
  },
};

// ─── Helper: persist email log to DB (best-effort) ────────────
export async function logEmailToDb(log: EmailLog, organizationId?: string) {
  try {
    // We don't have a dedicated email_logs table, so we use audit_logs
    if (!supabaseAdmin) return;
    // Best-effort — don't await in the caller
    supabaseAdmin.from("audit_logs").insert({
      actor_id: null,
      actor_email: "system@restopanel.com",
      actor_role: "SYSTEM",
      action: "EMAIL_SENT",
      target_type: "email",
      target_id: null,
      target_name: Array.isArray(log.to) ? log.to.join(",") : log.to,
      organization_id: organizationId || null,
      details: {
        subject: log.subject,
        status: log.status,
        attempt: log.attempt,
        messageId: log.messageId,
        error: log.error,
      },
      ip_address: null,
      user_agent: null,
    }).then(({ error }: any) => {
      if (error) console.warn("[email] Failed to log to audit_logs:", error.message);
    });
  } catch {
    // silent
  }
}

// ─── Convenience: send + log ──────────────────────────────────
export async function sendEmailAndLog(opts: SendEmailOptions & { organizationId?: string }): Promise<EmailLog> {
  const log = await sendEmail(opts);
  await logEmailToDb(log, opts.organizationId);
  return log;
}
