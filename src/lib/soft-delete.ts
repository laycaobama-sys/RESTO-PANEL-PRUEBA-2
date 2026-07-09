// ============================================================
// RestoPanel · Soft Delete Helper
// ============================================================
// Instead of DELETE, we set deleted_at = now().
// Queries should filter WHERE deleted_at IS NULL.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

// Tables that support soft delete
const SOFT_DELETE_TABLES = [
  "reservations",
  "customers",
  "users",
  "menu_items",
  "categories",
  "tables",
  "organizations",
];

export async function softDelete(
  table: string,
  id: string,
  organizationId: string
): Promise<boolean> {
  if (!SOFT_DELETE_TABLES.includes(table)) {
    // For tables without soft delete, do hard delete
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    return !error;
  }

  const { error } = await supabaseAdmin
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId);

  return !error;
}

export async function restoreSoftDelete(
  table: string,
  id: string,
  organizationId: string
): Promise<boolean> {
  if (!SOFT_DELETE_TABLES.includes(table)) return false;

  const { error } = await supabaseAdmin
    .from(table)
    .update({ deleted_at: null })
    .eq("id", id)
    .eq("organization_id", organizationId);

  return !error;
}

// ─── Get deleted records ─────────────────────────────────────
export async function getDeletedRecords(
  table: string,
  organizationId: string,
  limit = 50
) {
  if (!SOFT_DELETE_TABLES.includes(table)) return [];

  const { data, error } = await supabaseAdmin
    .from(table)
    .select("*")
    .eq("organization_id", organizationId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}
