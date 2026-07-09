// ============================================================
// RestoPanel · RBAC (Role-Based Access Control) Service
// ============================================================
// Provides permission checking for any user action.
// Uses cached role→permissions mapping for performance.
//
// Usage:
//   import { hasPermission, requirePermission } from "@/lib/rbac";
//
//   // In API route:
//   await requirePermission(user, "reservations.create");
//
//   // In component:
//   const canEdit = await hasPermission(user, "menu.manage");
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

// Cache: role_id → Set<permission_code>
// TTL: 5 minutes. Invalidated on role permission changes.
const rolePermissionsCache = new Map<string, { permissions: Set<string>; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

// Cache: user_id → role_id (per organization)
const userRoleCache = new Map<string, { roleId: string; cachedAt: number }>();
const USER_ROLE_CACHE_TTL = 5 * 60 * 1000;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isSuperAdmin: boolean;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  impersonatingOrgId: string | null;
  impersonatingOrgName: string | null;
}

// ─── Get user's role ID within their organization ────────────
async function getUserRoleId(userId: string, organizationId: string): Promise<string | null> {
  const cacheKey = `${userId}:${organizationId}`;
  const cached = userRoleCache.get(cacheKey);

  if (cached && Date.now() - cached.cachedAt < USER_ROLE_CACHE_TTL) {
    return cached.roleId;
  }

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  userRoleCache.set(cacheKey, { roleId: data.role_id, cachedAt: Date.now() });
  return data.role_id;
}

// ─── Get permissions for a role ──────────────────────────────
async function getRolePermissions(roleId: string): Promise<Set<string>> {
  const cached = rolePermissionsCache.get(roleId);

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.permissions;
  }

  const { data, error } = await supabaseAdmin
    .from("role_permissions")
    .select("permissions!inner(code)")
    .eq("role_id", roleId);

  if (error || !data) {
    return new Set();
  }

  const permissions = new Set(data.map((r: any) => r.permissions.code));
  rolePermissionsCache.set(roleId, { permissions, cachedAt: Date.now() });
  return permissions;
}

// ─── Check if user has a specific permission ─────────────────
export async function hasPermission(
  user: AuthUser | null,
  permissionCode: string
): Promise<boolean> {
  if (!user) return false;

  // Super admins have all permissions
  if (user.isSuperAdmin) return true;

  if (!user.organizationId) return false;

  const roleId = await getUserRoleId(user.id, user.organizationId);
  if (!roleId) return false;

  const permissions = await getRolePermissions(roleId);
  return permissions.has(permissionCode);
}

// ─── Check multiple permissions (any match) ──────────────────
export async function hasAnyPermission(
  user: AuthUser | null,
  permissionCodes: string[]
): Promise<boolean> {
  for (const code of permissionCodes) {
    if (await hasPermission(user, code)) return true;
  }
  return false;
}

// ─── Check multiple permissions (all must match) ─────────────
export async function hasAllPermissions(
  user: AuthUser | null,
  permissionCodes: string[]
): Promise<boolean> {
  for (const code of permissionCodes) {
    if (!(await hasPermission(user, code))) return false;
  }
  return true;
}

// ─── Require permission (throws 403 if not allowed) ──────────
export async function requirePermission(
  user: AuthUser | null,
  permissionCode: string
): Promise<{ authorized: boolean; response?: Response }> {
  if (!user) {
    return {
      authorized: false,
      response: new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const allowed = await hasPermission(user, permissionCode);
  if (!allowed) {
    return {
      authorized: false,
      response: new Response(
        JSON.stringify({ error: "Forbidden", required: permissionCode }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  return { authorized: true };
}

// ─── Get all permissions for a user (for UI) ─────────────────
export async function getUserPermissions(
  userId: string,
  organizationId: string,
  isSuperAdmin: boolean
): Promise<string[]> {
  if (isSuperAdmin) {
    // Return all permission codes
    const { data } = await supabaseAdmin.from("permissions").select("code");
    return data?.map((p: any) => p.code) || [];
  }

  const roleId = await getUserRoleId(userId, organizationId);
  if (!roleId) return [];

  const permissions = await getRolePermissions(roleId);
  return Array.from(permissions);
}

// ─── Invalidate cache (call when roles/permissions change) ───
export function invalidateRbacCache(roleId?: string) {
  if (roleId) {
    rolePermissionsCache.delete(roleId);
  } else {
    rolePermissionsCache.clear();
  }
  userRoleCache.clear();
}

// ─── Get role label for display ──────────────────────────────
export async function getUserRoleLabel(
  userId: string,
  organizationId: string
): Promise<string> {
  const roleId = await getUserRoleId(userId, organizationId);
  if (!roleId) return "Sin rol";

  const { data } = await supabaseAdmin
    .from("roles")
    .select("label")
    .eq("id", roleId)
    .maybeSingle();

  return data?.label || "Sin rol";
}

// ─── Assign role to user ─────────────────────────────────────
export async function assignRole(
  userId: string,
  roleId: string,
  organizationId: string,
  assignedBy: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("user_roles")
    .upsert(
      {
        user_id: userId,
        role_id: roleId,
        organization_id: organizationId,
        assigned_by: assignedBy,
      },
      { onConflict: "user_id,organization_id" }
    );

  if (error) {
    console.error("[rbac] assignRole error:", error);
    return false;
  }

  invalidateRbacCache();
  return true;
}

// ─── Get all roles (for admin UI) ────────────────────────────
export async function getAllRoles(organizationId?: string) {
  let query = supabaseAdmin
    .from("roles")
    .select("*")
    .order("is_system", { ascending: false })
    .order("label");

  if (organizationId) {
    query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
  }

  const { data, error } = await query;
  if (error) return [];
  return data;
}

// ─── Get all permissions (for admin UI) ──────────────────────
export async function getAllPermissions() {
  const { data, error } = await supabaseAdmin
    .from("permissions")
    .select("*")
    .order("module")
    .order("label");

  if (error) return [];
  return data;
}

// ─── Get permissions for a role ──────────────────────────────
export async function getPermissionsForRole(roleId: string) {
  const { data, error } = await supabaseAdmin
    .from("role_permissions")
    .select("permissions!inner(code, label, module)")
    .eq("role_id", roleId);

  if (error) return [];
  return data?.map((r: any) => r.permissions) || [];
}

// ─── Update role permissions ─────────────────────────────────
export async function updateRolePermissions(
  roleId: string,
  permissionCodes: string[]
): Promise<boolean> {
  // Delete existing
  await supabaseAdmin.from("role_permissions").delete().eq("role_id", roleId);

  // Insert new
  if (permissionCodes.length === 0) {
    invalidateRbacCache(roleId);
    return true;
  }

  // Get permission IDs from codes
  const { data: perms } = await supabaseAdmin
    .from("permissions")
    .select("id")
    .in("code", permissionCodes);

  if (!perms || perms.length === 0) {
    invalidateRbacCache(roleId);
    return true;
  }

  const inserts = perms.map((p: any) => ({
    role_id: roleId,
    permission_id: p.id,
  }));

  const { error } = await supabaseAdmin
    .from("role_permissions")
    .insert(inserts);

  if (error) {
    console.error("[rbac] updateRolePermissions error:", error);
    return false;
  }

  invalidateRbacCache(roleId);
  return true;
}
