// ============================================================
// RestoPanel · Inventario + Escandallos + Proveedores + Compras
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

// ─── INVENTARIO ──────────────────────────────────────────────

export async function listInventory(organizationId: string, lowStockOnly: boolean = false) {
  let q = supabaseAdmin
    .from("inventory_items")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name");
  if (lowStockOnly) q = q.filter("stock_current", "lte", "stock_min");
  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

export async function createInventoryItem(organizationId: string, item: any) {
  const { data, error } = await supabaseAdmin
    .from("inventory_items")
    .insert({ organization_id: organizationId, ...item })
    .select("*")
    .single();
  if (error) return null;
  return data;
}

export async function updateStock(organizationId: string, itemId: string, newStock: number, reason: string, userId?: string) {
  const { data: item } = await supabaseAdmin
    .from("inventory_items")
    .select("stock_current")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!item) return false;

  const diff = newStock - Number(item.stock_current);

  await supabaseAdmin.from("inventory_items").update({ stock_current: newStock, updated_at: new Date().toISOString() }).eq("id", itemId);
  await supabaseAdmin.from("inventory_movements").insert({
    organization_id: organizationId,
    item_id: itemId,
    type: "ADJUSTMENT",
    quantity: diff,
    reason,
    user_id: userId || null,
  });
  return true;
}

// ─── ESCANDALLOS ─────────────────────────────────────────────

export async function listRecipes(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("recipes")
    .select("*, recipe_ingredients(*), menu_items(name)")
    .eq("organization_id", organizationId)
    .order("name");
  if (error) return [];
  return data || [];
}

export async function calculateRecipeCost(recipeId: string): Promise<number> {
  const { data: ingredients } = await supabaseAdmin
    .from("recipe_ingredients")
    .select("total_cost")
    .eq("recipe_id", recipeId);
  if (!ingredients) return 0;
  return ingredients.reduce((s, i) => s + Number(i.total_cost), 0);
}

export async function recalculateRecipe(recipeId: string) {
  const { data: recipe } = await supabaseAdmin
    .from("recipes")
    .select("organization_id, portions, waste_pct, menu_item_id")
    .eq("id", recipeId)
    .maybeSingle();
  if (!recipe) return;

  const { data: ingredients } = await supabaseAdmin
    .from("recipe_ingredients")
    .select("id, quantity, unit_cost, total_cost, inventory_item_id")
    .eq("recipe_id", recipeId) as any;

  if (!ingredients) return;

  let totalCost = 0;
  for (const ing of ingredients) {
    // Recargar precio actual del inventory_item
    if (ing.inventory_item_id) {
      const { data: item } = await supabaseAdmin
        .from("inventory_items")
        .select("purchase_price")
        .eq("id", ing.inventory_item_id)
        .maybeSingle();
      if (item) {
        const newCost = Number(item.purchase_price) * Number(ing.quantity);
        await supabaseAdmin.from("recipe_ingredients").update({ unit_cost: item.purchase_price, total_cost: newCost }).eq("id", ing.id);
        totalCost += newCost;
      }
    } else {
      totalCost += Number(ing.total_cost);
    }
  }

  // Aplicar merma
  const costWithWaste = totalCost * (1 + Number(recipe.waste_pct || 0) / 100);
  const costPerPortion = recipe.portions > 0 ? costWithWaste / recipe.portions : costWithWaste;

  await supabaseAdmin
    .from("recipes")
    .update({ total_cost: costWithWaste, cost_per_portion: costPerPortion, updated_at: new Date().toISOString() })
    .eq("id", recipeId);
}

// ─── PROVEEDORES ─────────────────────────────────────────────

export async function listSuppliers(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("suppliers")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name");
  if (error) return [];
  return data || [];
}

export async function createSupplier(organizationId: string, supplier: any) {
  const { data, error } = await supabaseAdmin
    .from("suppliers")
    .insert({ organization_id: organizationId, ...supplier })
    .select("*")
    .single();
  if (error) return null;
  return data;
}

// ─── COMPRAS IA ──────────────────────────────────────────────

export async function suggestPurchaseOrders(organizationId: string): Promise<Array<{
  item: any;
  supplier: any;
  suggested_qty: number;
  estimated_cost: number;
  reason: string;
}>> {
  // Buscar items bajo de stock
  const { data: lowStock } = await supabaseAdmin
    .from("inventory_items")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .filter("stock_current", "lte", "stock_min");

  if (!lowStock || lowStock.length === 0) return [];

  const suggestions: any[] = [];
  for (const item of lowStock as any[]) {
    // Calcular cantidad óptima: stock_ideal - stock_current
    const suggestedQty = Math.max(Number(item.stock_ideal) - Number(item.stock_current), Number(item.stock_min));

    // Buscar proveedor
    let supplier: any = null;
    if (item.supplier_id) {
      const { data: sup } = await supabaseAdmin
        .from("suppliers")
        .select("*")
        .eq("id", item.supplier_id)
        .maybeSingle();
      supplier = sup;
    }

    suggestions.push({
      item,
      supplier,
      suggested_qty: suggestedQty,
      estimated_cost: suggestedQty * Number(item.purchase_price),
      reason: `Stock actual (${item.stock_current}) ≤ mínimo (${item.stock_min})`,
    });
  }

  return suggestions;
}

export async function createPurchaseOrder(organizationId: string, opts: {
  supplierId: string;
  lines: Array<{ itemId?: string; name: string; quantity: number; unitCost: number; unit?: string }>;
  aiRecommended?: boolean;
  aiReason?: string;
  userId?: string;
}) {
  const subtotal = opts.lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const tax = subtotal * 0.10; // IVA 10% hostelería
  const total = subtotal + tax;
  const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;

  const { data: po, error } = await supabaseAdmin
    .from("purchase_orders")
    .insert({
      organization_id: organizationId,
      supplier_id: opts.supplierId,
      number: poNumber,
      status: "DRAFT",
      subtotal,
      tax_amount: tax,
      total,
      ai_recommended: opts.aiRecommended || false,
      ai_reason: opts.aiReason || null,
      created_by: opts.userId || null,
    })
    .select("*")
    .single();

  if (error || !po) return null;

  // Insertar líneas
  for (const line of opts.lines) {
    await supabaseAdmin.from("purchase_order_lines").insert({
      purchase_order_id: po.id,
      organization_id: organizationId,
      inventory_item_id: line.itemId || null,
      name: line.name,
      quantity_ordered: line.quantity,
      unit: line.unit || "UNIDAD",
      unit_cost: line.unitCost,
      total_cost: line.quantity * line.unitCost,
    });
  }

  return po;
}

// ─── RECEPCIÓN DE MERCANCÍA ──────────────────────────────────

export async function receivePurchaseOrder(organizationId: string, poId: string, receptions: Array<{
  lineId: string;
  quantityReceived: number;
  lotNumber?: string;
  expiryDate?: string;
  temperature?: number;
  hasIncidence?: boolean;
  incidenceNote?: string;
}>) {
  const { data: po } = await supabaseAdmin
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!po) return { ok: false, message: "Pedido no encontrado" };

  let allReceived = true;
  for (const r of receptions) {
    const { data: line } = await supabaseAdmin
      .from("purchase_order_lines")
      .select("*")
      .eq("id", r.lineId)
      .maybeSingle();
    if (!line) continue;

    await supabaseAdmin
      .from("purchase_order_lines")
      .update({
        quantity_received: r.quantityReceived,
        lot_number: r.lotNumber || null,
        expiry_date: r.expiryDate || null,
        temperature: r.temperature || null,
        has_incidence: r.hasIncidence || false,
        incidence_note: r.incidenceNote || null,
      })
      .eq("id", r.lineId);

    // Actualizar inventario
    if (line.inventory_item_id) {
      const { data: item } = await supabaseAdmin
        .from("inventory_items")
        .select("stock_current")
        .eq("id", line.inventory_item_id)
        .maybeSingle();
      if (item) {
        const newStock = Number(item.stock_current) + r.quantityReceived;
        await supabaseAdmin.from("inventory_items").update({
          stock_current: newStock,
          lot_number: r.lotNumber || null,
          expiry_date: r.expiryDate || null,
          updated_at: new Date().toISOString(),
        }).eq("id", line.inventory_item_id);

        await supabaseAdmin.from("inventory_movements").insert({
          organization_id: organizationId,
          item_id: line.inventory_item_id,
          type: "PURCHASE",
          quantity: r.quantityReceived,
          unit_cost: line.unit_cost,
          reason: `Recepción pedido ${po.number}`,
          supplier_id: po.supplier_id,
          reference: po.number,
        });
      }
    }

    if (r.quantityReceived < line.quantity_ordered) allReceived = false;
  }

  await supabaseAdmin
    .from("purchase_orders")
    .update({
      status: allReceived ? "RECEIVED" : "PARTIAL",
      received_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  return { ok: true, message: allReceived ? "Mercancía recibida completamente" : "Recepción parcial registrada" };
}

// ─── CONTROL HORARIO ─────────────────────────────────────────

export async function clockIn(organizationId: string, userId: string, opts: {
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
  ipAddress?: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("time_clock")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      type: "CLOCK_IN",
      latitude: opts.latitude || null,
      longitude: opts.longitude || null,
      device_info: opts.deviceInfo || null,
      ip_address: opts.ipAddress || null,
    })
    .select("*")
    .single();
  if (error) return null;
  return data;
}

export async function clockOut(organizationId: string, userId: string, opts: {
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
  ipAddress?: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("time_clock")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      type: "CLOCK_OUT",
      latitude: opts.latitude || null,
      longitude: opts.longitude || null,
      device_info: opts.deviceInfo || null,
      ip_address: opts.ipAddress || null,
    })
    .select("*")
    .single();
  if (error) return null;
  return data;
}

export async function getTimeClockHistory(organizationId: string, userId?: string, days: number = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let q = supabaseAdmin
    .from("time_clock")
    .select("*")
    .eq("organization_id", organizationId)
    .gte("timestamp", since.toISOString())
    .order("timestamp", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) return [];
  return data || [];
}
