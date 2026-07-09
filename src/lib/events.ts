// ============================================================
// RestoPanel · Event System + Correlation ID
// ============================================================
// Every significant action generates an event that other modules
// can react to. Events carry a correlation_id that links all
// related actions together (reservation → email → whatsapp → analytics).
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";

export type EventType =
  | "reservation.created"
  | "reservation.confirmed"
  | "reservation.cancelled"
  | "reservation.completed"
  | "reservation.no_show"
  | "reservation.transferred"
  | "table.occupied"
  | "table.freed"
  | "table.transferred"
  | "customer.created"
  | "customer.updated"
  | "order.created"
  | "order.completed"
  | "email.queued"
  | "email.sent"
  | "email.failed"
  | "whatsapp.queued"
  | "whatsapp.sent"
  | "whatsapp.failed"
  | "user.login"
  | "user.logout"
  | "user.created"
  | "user.role_changed"
  | "menu.item_created"
  | "menu.item_updated"
  | "menu.item_deleted"
  | "settings.updated"
  | "subscription.changed"
  | "feature_flag.toggled";

export interface AppEvent {
  type: EventType | string;
  organizationId?: string;
  entityType?: string;
  entityId?: string;
  payload?: any;
  correlationId?: string;
}

// ─── Emit an event ────────────────────────────────────────────
export async function emit(event: AppEvent): Promise<string> {
  const correlationId = event.correlationId || randomUUID();

  try {
    await supabaseAdmin.from("event_log").insert({
      organization_id: event.organizationId || null,
      event_type: event.type,
      entity_type: event.entityType || null,
      entity_id: event.entityId || null,
      payload: event.payload || null,
      correlation_id: correlationId,
    });
  } catch (e: any) {
    logger.warn("Failed to emit event", "events", { type: event.type, error: e.message });
  }

  logger.debug(`Event: ${event.type}`, "events", { correlationId, entityType: event.entityType, entityId: event.entityId });

  return correlationId;
}

// ─── Get events by correlation ID ────────────────────────────
export async function getEventsByCorrelation(correlationId: string) {
  const { data, error } = await supabaseAdmin
    .from("event_log")
    .select("*")
    .eq("correlation_id", correlationId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return data || [];
}

// ─── Get events by entity ────────────────────────────────────
export async function getEventsByEntity(
  organizationId: string,
  entityType: string,
  entityId: string,
  limit = 20
) {
  const { data, error } = await supabaseAdmin
    .from("event_log")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

// ─── Get recent events for org ───────────────────────────────
export async function getRecentEvents(organizationId: string, limit = 50) {
  const { data, error } = await supabaseAdmin
    .from("event_log")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}
