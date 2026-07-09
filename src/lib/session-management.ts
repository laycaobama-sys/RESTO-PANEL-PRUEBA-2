// ============================================================
// RestoPanel · Session Management Service
// ============================================================
// Tracks active user sessions for:
//   - Remote session invalidation (logout from other devices)
//   - Device tracking
//   - Brute force protection (failed login attempts)
//   - Activity logging
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

// ─── Session tracking ────────────────────────────────────────

export async function createSession(
  userId: string,
  organizationId: string | null,
  jti: string,
  ipAddress: string | null,
  userAgent: string | null,
  expiresAt: Date
): Promise<void> {
  try {
    await supabaseAdmin.from("user_sessions").insert({
      user_id: userId,
      organization_id: organizationId,
      token_jti: jti,
      device_info: userAgent,
      ip_address: ipAddress,
      expires_at: expiresAt.toISOString(),
    });
  } catch (e) {
    // Non-critical: session works without DB tracking
  }
}

export async function isSessionValid(jti: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from("user_sessions")
      .select("revoked_at, expires_at")
      .eq("token_jti", jti)
      .maybeSingle();

    if (!data) return true; // If session not tracked, allow (backward compat)
    if (data.revoked_at) return false; // Session was revoked
    if (new Date(data.expires_at) < new Date()) return false; // Expired
    return true;
  } catch {
    return true; // Non-critical
  }
}

export async function revokeSession(jti: string): Promise<void> {
  try {
    await supabaseAdmin
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_jti", jti);
  } catch {}
}

/**
 * Revoke a session by JTI AND user_id — use this instead of
 * revokeSession() whenever the caller is a regular user (not a
 * super-admin). Prevents IDOR: without the user_id filter, any
 * authenticated user could revoke any other user's session by
 * passing that user's jti.
 */
export async function revokeSessionByJtiAndUser(jti: string, userId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_jti", jti)
      .eq("user_id", userId);
  } catch {}
}

export async function revokeAllUserSessions(userId: string, exceptJti?: string): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("revoked_at", null);

    if (exceptJti) {
      query = query.neq("token_jti", exceptJti);
    }

    await query;
  } catch {}
}

export async function getActiveSessions(userId: string) {
  try {
    const { data } = await supabaseAdmin
      .from("user_sessions")
      .select("*")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    return data || [];
  } catch {
    return [];
  }
}

export async function updateSessionActivity(jti: string): Promise<void> {
  try {
    await supabaseAdmin
      .from("user_sessions")
      .update({ last_activity: new Date().toISOString() })
      .eq("token_jti", jti);
  } catch {}
}

// ─── Activity logging ────────────────────────────────────────

export async function logActivity(
  userId: string,
  organizationId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: any,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<void> {
  try {
    await supabaseAdmin.from("user_activity").insert({
      user_id: userId,
      organization_id: organizationId,
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      details: details || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    });
  } catch {
    // Non-critical: activity log is best-effort
  }
}

// ─── User profile ────────────────────────────────────────────

export async function getUserProfile(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

export async function updateUserProfile(
  userId: string,
  updates: {
    avatar_url?: string;
    language?: string;
    timezone?: string;
    preferences?: any;
  }
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("user_profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return !error;
}

export async function updateLastLogin(
  userId: string,
  ipAddress: string | null,
  userAgent: string | null
): Promise<void> {
  try {
    await supabaseAdmin
      .from("user_profiles")
      .update({
        last_login_at: new Date().toISOString(),
        last_login_ip: ipAddress,
        last_user_agent: userAgent,
      })
      .eq("user_id", userId);
  } catch {}
}

// ─── Brute force protection ──────────────────────────────────

const loginAttempts = new Map<string, { count: number; firstAt: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const WINDOW_DURATION = 5 * 60 * 1000; // 5 minutes

export function isAccountLocked(email: string): boolean {
  const entry = loginAttempts.get(email.toLowerCase());
  if (!entry) return false;
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) return true;
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    loginAttempts.delete(email.toLowerCase());
    return false;
  }
  return false;
}

export function recordFailedLogin(email: string): { locked: boolean; attemptsLeft: number } {
  const key = email.toLowerCase();
  const now = Date.now();
  let entry = loginAttempts.get(key);

  if (!entry || now - entry.firstAt > WINDOW_DURATION) {
    entry = { count: 1, firstAt: now, lockedUntil: 0 };
  } else {
    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) {
      entry.lockedUntil = now + LOCKOUT_DURATION;
    }
  }

  loginAttempts.set(key, entry);
  return {
    locked: entry.lockedUntil > 0,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - entry.count),
  };
}

export function recordSuccessfulLogin(email: string): void {
  loginAttempts.delete(email.toLowerCase());
}

export function getLockoutRemaining(email: string): number {
  const entry = loginAttempts.get(email.toLowerCase());
  if (!entry || !entry.lockedUntil) return 0;
  return Math.max(0, Math.ceil((entry.lockedUntil - Date.now()) / 1000));
}

// ─── JTI generation for JWT ──────────────────────────────────
export function generateJti(): string {
  return randomUUID();
}
