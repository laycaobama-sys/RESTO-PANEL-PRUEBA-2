// ============================================================
// RestoPanel · TPV (POS) Service
// ============================================================
// Cobros, cuentas divididas, fusionar, propinas, descuentos,
// pagos mixtos (efectivo, tarjeta, Bizum, Apple Pay, Google Pay),
// vales, tarjetas regalo, facturas.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

// ─── Cobrar un pedido (cerrar mesa) ──────────────────────────
export async function processPayment(opts: {
  organizationId: string;
  orderId: string;
  payments: Array<{
    method: string;
    amount: number;
    tip?: number;
    reference?: string;
  }>;
  invoiceType?: 'TICKET' | 'SIMPLIFIED' | 'INVOICE';
  userId?: string;
}): Promise<{ ok: boolean; message: string; payments?: any[] }> {
  const { organizationId, orderId, payments, invoiceType = 'TICKET' } = opts;

  // Cargar el pedido
  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .select("id, total, payment_status, organization_id, table_id")
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (oErr || !order) return { ok: false, message: "Pedido no encontrado" };

  // Calcular total a pagar
  const totalToPay = Number(order.total);
  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);
  const totalTips = payments.reduce((s, p) => s + (p.tip || 0), 0);

  if (totalPayments < totalToPay) {
    return {
      ok: false,
      message: `Pago insuficiente. Faltan ${(totalToPay - totalPayments).toFixed(2)}€`,
    };
  }

  // Procesar cada pago
  const paymentRecords: any[] = [];
  for (const p of payments) {
    const { data, error } = await supabaseAdmin
      .from("order_payments")
      .insert({
        organization_id: organizationId,
        order_id: orderId,
        method: p.method,
        amount: p.amount,
        tip_amount: p.tip || 0,
        reference: p.reference || null,
        status: "COMPLETED",
      })
      .select("*")
      .single();
    if (error) {
      logger.error("Payment insert failed", "tpv", { error: error.message });
      return { ok: false, message: "Error al registrar pago: " + error.message };
    }
    paymentRecords.push(data);
  }

  // Generar número de factura/ticket
  const invoiceNumber = `${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  // Actualizar el pedido
  const { error: updateErr } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "PAID",
      payment_method: payments.length > 1 ? "MIXED" : payments[0].method,
      tip_amount: totalTips,
      invoice_number: invoiceNumber,
      invoice_type: invoiceType,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("organization_id", organizationId);

  if (updateErr) {
    logger.error("Order update failed", "tpv", { error: updateErr.message });
    return { ok: false, message: "Error al actualizar pedido" };
  }

  // Liberar la mesa si estaba ocupada
  if (order.table_id) {
    await supabaseAdmin
      .from("tables")
      .update({ status: "AVAILABLE", updated_at: new Date().toISOString() })
      .eq("id", order.table_id)
      .eq("organization_id", organizationId);
  }

  // Registrar en CRM del cliente si existe
  // (el trigger de customer_metrics se encarga)

  logger.info("Payment processed", "tpv", {
    orderId,
    total: totalToPay,
    payments: payments.length,
    tips: totalTips,
  });

  return {
    ok: true,
    message: `Cobro completado: ${totalPayments.toFixed(2)}€ + ${totalTips.toFixed(2)}€ propina`,
    payments: paymentRecords,
  };
}

// ─── Dividir cuenta ──────────────────────────────────────────
export async function splitBill(
  organizationId: string,
  orderId: string,
  splits: Array<{ itemIds: string[]; label?: string }>
): Promise<{ ok: boolean; message: string; newOrders?: any[] }> {
  // Cargar el pedido original con sus items
  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (oErr || !order) return { ok: false, message: "Pedido no encontrado" };

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .eq("organization_id", organizationId);

  if (!items || items.length === 0) return { ok: false, message: "El pedido no tiene items" };

  const newOrders: any[] = [];

  for (const split of splits) {
    const splitItems = (items || []).filter(i => split.itemIds.includes(i.id));
    if (splitItems.length === 0) continue;

    const total = splitItems.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);

    // Crear pedido hijo
    const { data: newOrder, error: nErr } = await supabaseAdmin
      .from("orders")
      .insert({
        organization_id: organizationId,
        number: order.number + 100, // offset para cuentas divididas
        status: "COMPLETED",
        order_type: order.order_type,
        total,
        table_id: order.table_id,
        parent_order_id: orderId,
        payment_status: "UNPAID",
      })
      .select("*")
      .single();

    if (nErr) continue;

    // Copiar items al nuevo pedido
    for (const item of splitItems) {
      await supabaseAdmin.from("order_items").insert({
        order_id: newOrder.id,
        organization_id: organizationId,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes,
      });
    }

    newOrders.push(newOrder);
  }

  return {
    ok: true,
    message: `Cuenta dividida en ${newOrders.length} partes`,
    newOrders,
  };
}

// ─── Fusionar cuentas ────────────────────────────────────────
export async function mergeBills(
  organizationId: string,
  orderIds: string[]
): Promise<{ ok: boolean; message: string; mergedOrder?: any }> {
  if (orderIds.length < 2) return { ok: false, message: "Necesitas al menos 2 pedidos para fusionar" };

  // Cargar todos los pedidos
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("*")
    .in("id", orderIds)
    .eq("organization_id", organizationId);

  if (!orders || orders.length < 2) return { ok: false, message: "Pedidos no encontrados" };

  // Calcular total
  const total = orders.reduce((s, o) => s + Number(o.total), 0);

  // Usar el primer pedido como principal
  const mainOrder = orders[0];

  // Mover items de los otros pedidos al principal
  for (let i = 1; i < orders.length; i++) {
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", orders[i].id)
      .eq("organization_id", organizationId);

    if (items && items.length > 0) {
      for (const item of items) {
        await supabaseAdmin.from("order_items").insert({
          order_id: mainOrder.id,
          organization_id: organizationId,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.notes,
        });
      }
    }

    // Eliminar el pedido secundario
    await supabaseAdmin
      .from("orders")
      .delete()
      .eq("id", orders[i].id)
      .eq("organization_id", organizationId);
  }

  // Actualizar total del pedido principal
  await supabaseAdmin
    .from("orders")
    .update({ total, updated_at: new Date().toISOString() })
    .eq("id", mainOrder.id);

  return { ok: true, message: "Cuentas fusionadas", mergedOrder: mainOrder };
}

// ─── Aplicar descuento ───────────────────────────────────────
export async function applyDiscount(
  organizationId: string,
  orderId: string,
  discountType: 'PERCENTAGE' | 'FIXED',
  discountValue: number,
  reason?: string
): Promise<{ ok: boolean; message: string }> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("total, subtotal")
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!order) return { ok: false, message: "Pedido no encontrado" };

  const discount = discountType === 'PERCENTAGE'
    ? (Number(order.subtotal || order.total) * discountValue) / 100
    : discountValue;

  const newTotal = Number(order.total) - discount;

  await supabaseAdmin
    .from("orders")
    .update({
      discount_amount: discount,
      total: newTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("organization_id", organizationId);

  return { ok: true, message: `Descuento aplicado: -${discount.toFixed(2)}€` };
}

// ─── Crear tarjeta regalo ────────────────────────────────────
export async function createGiftCard(
  organizationId: string,
  initialBalance: number,
  customerId?: string
): Promise<{ ok: boolean; code?: string; message: string }> {
  const code = `RP${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const { data, error } = await supabaseAdmin
    .from("gift_cards")
    .insert({
      organization_id: organizationId,
      code,
      initial_balance: initialBalance,
      current_balance: initialBalance,
      customer_id: customerId || null,
    })
    .select("*")
    .single();

  if (error) return { ok: false, message: "Error al crear tarjeta regalo" };

  return { ok: true, code, message: "Tarjeta regalo creada" };
}

// ─── Usar tarjeta regalo ─────────────────────────────────────
export async function redeemGiftCard(
  organizationId: string,
  code: string,
  amount: number
): Promise<{ ok: boolean; remaining?: number; message: string }> {
  const { data: card, error } = await supabaseAdmin
    .from("gift_cards")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !card) return { ok: false, message: "Tarjeta regalo no válida" };
  if (new Date(card.expires_at) < new Date()) return { ok: false, message: "Tarjeta regalo caducada" };
  if (Number(card.current_balance) < amount) return { ok: false, message: "Saldo insuficiente en la tarjeta" };

  const remaining = Number(card.current_balance) - amount;
  await supabaseAdmin
    .from("gift_cards")
    .update({ current_balance: remaining, updated_at: new Date().toISOString() })
    .eq("id", card.id);

  return { ok: true, remaining, message: `Tarjeta regalo usada: -${amount}€` };
}
