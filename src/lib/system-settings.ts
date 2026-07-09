// ============================================================
// RestoPanel · System Settings Service
// ============================================================
// Global configuration managed by SuperAdmin.
// Includes maintenance mode, limits, defaults.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

// Cache: key → { value, cachedAt }
const settingsCache = new Map<string, { value: any; cachedAt: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds

export async function getSetting<T = any>(key: string, defaultValue?: T): Promise<T> {
  const cached = settingsCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.value as T;
  }

  try {
    const { data } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    const value = data?.value ?? defaultValue;
    settingsCache.set(key, { value, cachedAt: Date.now() });
    return value as T;
  } catch {
    return defaultValue as T;
  }
}

export async function setSetting(key: string, value: any, updatedBy?: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from("system_settings")
      .upsert({
        key,
        value,
        updated_by: updatedBy || null,
        updated_at: new Date().toISOString(),
      });

    if (error) return false;

    // Invalidate cache
    settingsCache.delete(key);
    return true;
  } catch {
    return false;
  }
}

export async function getAllSettings(category?: string) {
  let query = supabaseAdmin.from("system_settings").select("*").order("category").order("key");
  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

// ─── Maintenance mode ────────────────────────────────────────
export async function isMaintenanceMode(): Promise<boolean> {
  const value = await getSetting<any>("maintenance_mode", false);
  return value === true || value === "true";
}

export async function setMaintenanceMode(enabled: boolean, message?: string, updatedBy?: string): Promise<void> {
  await setSetting("maintenance_mode", enabled, updatedBy);
  if (message !== undefined) {
    await setSetting("maintenance_message", message, updatedBy);
  }
}

export async function getMaintenanceMessage(): Promise<string> {
  return await getSetting<string>("maintenance_message", "Estamos realizando mejoras. Volveremos pronto.");
}

// ─── Invalidate cache ────────────────────────────────────────
export function invalidateSettingsCache() {
  settingsCache.clear();
}
