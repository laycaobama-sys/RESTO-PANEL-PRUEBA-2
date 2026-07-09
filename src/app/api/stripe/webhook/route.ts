import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") || "";

  const event = verifyWebhookSignature(payload, signature);
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  logger.info(`Stripe webhook: ${event.type}`, "stripe-webhook", { id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const orgId = session.metadata?.organization_id;
        const planName = session.metadata?.plan_name;
        const billingCycle = session.metadata?.billing_cycle;

        if (orgId && session.subscription) {
          const sub = await supabaseAdmin
            .from("organization_subscriptions")
            .update({
              stripe_subscription_id: session.subscription,
              status: "active",
              billing_cycle: billingCycle || "monthly",
              current_period_start: new Date().toISOString(),
            })
            .eq("organization_id", orgId);

          // Update plan
          const { data: plan } = await supabaseAdmin
            .from("subscription_plans")
            .select("id")
            .eq("name", planName)
            .single();

          if (plan) {
            await supabaseAdmin
              .from("organization_subscriptions")
              .update({ plan_id: plan.id })
              .eq("organization_id", orgId);
          }

          // Log history
          await supabaseAdmin.from("subscription_history").insert({
            organization_id: orgId,
            event_type: "subscription.created",
            to_plan: planName,
            to_cycle: billingCycle,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as any;
        const orgId = sub.metadata?.organization_id;

        if (orgId) {
          const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
          const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null;

          await supabaseAdmin
            .from("organization_subscriptions")
            .update({
              status: sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : sub.status === "canceled" ? "canceled" : sub.status,
              current_period_start: periodStart,
              current_period_end: periodEnd,
              cancel_at_period_end: sub.cancel_at_period_end,
            })
            .eq("organization_id", orgId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        const orgId = sub.metadata?.organization_id;

        if (orgId) {
          await supabaseAdmin
            .from("organization_subscriptions")
            .update({
              status: "canceled",
              canceled_at: new Date().toISOString(),
            })
            .eq("organization_id", orgId);

          await supabaseAdmin.from("subscription_history").insert({
            organization_id: orgId,
            event_type: "subscription.canceled",
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer;

        // Find org by customer ID
        const { data: orgSub } = await supabaseAdmin
          .from("organization_subscriptions")
          .select("organization_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (orgSub) {
          await supabaseAdmin.from("invoices").upsert({
            organization_id: orgSub.organization_id,
            stripe_invoice_id: invoice.id,
            number: invoice.number,
            amount_paid: invoice.amount_paid / 100,
            amount_due: invoice.amount_due / 100,
            currency: invoice.currency,
            status: "paid",
            billing_reason: invoice.billing_reason,
            period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
            period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
            invoice_pdf_url: invoice.invoice_pdf,
            hosted_invoice_url: invoice.hosted_invoice_url,
            paid_at: new Date().toISOString(),
          });

          await supabaseAdmin.from("subscription_history").insert({
            organization_id: orgSub.organization_id,
            event_type: "invoice.paid",
            amount: invoice.amount_paid / 100,
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer;

        const { data: orgSub } = await supabaseAdmin
          .from("organization_subscriptions")
          .select("organization_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (orgSub) {
          await supabaseAdmin
            .from("organization_subscriptions")
            .update({ status: "past_due" })
            .eq("organization_id", orgSub.organization_id);

          await supabaseAdmin.from("subscription_history").insert({
            organization_id: orgSub.organization_id,
            event_type: "payment.failed",
            amount: invoice.amount_due / 100,
          });
        }
        break;
      }

      case "payment_method.attached": {
        const pm = event.data.object as any;
        const customerId = pm.customer;

        const { data: orgSub } = await supabaseAdmin
          .from("organization_subscriptions")
          .select("organization_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (orgSub) {
          await supabaseAdmin.from("payment_methods").upsert({
            organization_id: orgSub.organization_id,
            stripe_payment_method_id: pm.id,
            type: pm.type,
            brand: pm.card?.brand,
            last4: pm.card?.last4,
            exp_month: pm.card?.exp_month,
            exp_year: pm.card?.exp_year,
            is_default: true,
          });
        }
        break;
      }

      case "payment_method.detached": {
        const pm = event.data.object as any;
        await supabaseAdmin
          .from("payment_methods")
          .delete()
          .eq("stripe_payment_method_id", pm.id);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    logger.error("Stripe webhook error", "stripe-webhook", { error: e.message, type: event.type });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
