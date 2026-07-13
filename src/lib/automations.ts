// ============================================================
// RestoPanel · Motor de Automatizaciones
// ============================================================
// Trigger → Conditions → Actions. Permite crear flujos tipo
// Make.com/Zapier para automatizar operaciones del restaurante.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export interface Automation {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, any>;
  conditions: Array<{ field: string; operator: string; value: any }>;
  actions: AutomationAction[];
  is_active: boolean;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationAction {
  type: string;  // 'send_email','send_whatsapp','add_tag','remove_tag','create_task','notify_manager','create_coupon','add_points','change_priority','set_vip'
  config: Record<string, any>;
}

// Tipos de triggers soportados
export const TRIGGER_TYPES = {
  RESERVATION_CREATED: 'reservation.created',
  RESERVATION_CONFIRMED: 'reservation.confirmed',
  RESERVATION_CANCELLED: 'reservation.cancelled',
  RESERVATION_COMPLETED: 'reservation.completed',
  RESERVATION_NO_SHOW: 'reservation.no_show',
  CUSTOMER_BIRTHDAY: 'customer.birthday',
  CUSTOMER_VIP: 'customer.vip',
  CUSTOMER_ANNIVERSARY: 'customer.anniversary',
  LOYALTY_TIER_UP: 'loyalty.tier_up',
  WAITLIST_SEAT: 'waitlist.seat',
  NO_SHOW_THRESHOLD: 'no_show.threshold',
  TABLE_FREED: 'table.freed',
  LOW_OCCUPATION: 'low.occupation',
  HIGH_OCCUPATION: 'high.occupation',
} as const;

// Tipos de acciones soportadas
export const ACTION_TYPES = {
  SEND_EMAIL: 'send_email',
  SEND_WHATSAPP: 'send_whatsapp',
  ADD_TAG: 'add_tag',
  REMOVE_TAG: 'remove_tag',
  CREATE_TASK: 'create_task',
  NOTIFY_MANAGER: 'notify_manager',
  CREATE_COUPON: 'create_coupon',
  ADD_POINTS: 'add_points',
  CHANGE_PRIORITY: 'change_priority',
  SET_VIP: 'set_vip',
  REDUCE_PRIORITY: 'reduce_priority',
} as const;

// ─── Disparar automatizaciones por evento ────────────────────
export async function fireTrigger(
  organizationId: string,
  triggerType: string,
  triggerData: Record<string, any>
): Promise<void> {
  try {
    // Cargar automatizaciones activas para este trigger
    const { data: automations, error } = await supabaseAdmin
      .from('automations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('trigger_type', triggerType)
      .eq('is_active', true);

    if (error || !automations || automations.length === 0) return;

    for (const auto of automations) {
      // Verificar condiciones
      const conditionsMet = evaluateConditions(auto.conditions || [], triggerData);
      if (!conditionsMet) continue;

      // Ejecutar acciones secuencialmente
      const actionsExecuted: any[] = [];
      let hasError = false;
      const startTime = Date.now();

      for (const action of (auto.actions || []) as AutomationAction[]) {
        try {
          await executeAction(organizationId, action, triggerData);
          actionsExecuted.push({ type: action.type, status: 'success' });
        } catch (e: any) {
          actionsExecuted.push({ type: action.type, status: 'error', error: e.message });
          hasError = true;
          logger.warn('Automation action failed', 'automation', {
            automationId: auto.id,
            action: action.type,
            error: e.message,
          });
        }
      }

      // Actualizar contador de ejecuciones
      await supabaseAdmin
        .from('automations')
        .update({
          execution_count: (auto.execution_count || 0) + 1,
          last_executed_at: new Date().toISOString(),
        })
        .eq('id', auto.id);

      // Log de ejecución
      await supabaseAdmin.from('automation_executions').insert({
        automation_id: auto.id,
        organization_id: organizationId,
        trigger_data: triggerData,
        actions_executed: actionsExecuted,
        status: hasError ? (actionsExecuted.some(a => a.status === 'success') ? 'partial' : 'failed') : 'success',
        duration_ms: Date.now() - startTime,
      });
    }
  } catch (e: any) {
    logger.error('Error firing trigger', 'automation', {
      triggerType,
      error: e.message,
    });
  }
}

// ─── Evaluar condiciones ─────────────────────────────────────
function evaluateConditions(
  conditions: Array<{ field: string; operator: string; value: any }>,
  data: Record<string, any>
): boolean {
  if (!conditions || conditions.length === 0) return true;
  for (const cond of conditions) {
    const fieldValue = data[cond.field];
    switch (cond.operator) {
      case 'eq': if (fieldValue !== cond.value) return false; break;
      case 'ne': if (fieldValue === cond.value) return false; break;
      case 'gt': if (!(fieldValue > cond.value)) return false; break;
      case 'lt': if (!(fieldValue < cond.value)) return false; break;
      case 'gte': if (!(fieldValue >= cond.value)) return false; break;
      case 'lte': if (!(fieldValue <= cond.value)) return false; break;
      case 'contains': if (!String(fieldValue || '').includes(String(cond.value))) return false; break;
      case 'in': if (!cond.value?.includes(fieldValue)) return false; break;
      case 'not_in': if (cond.value?.includes(fieldValue)) return false; break;
      default: return false;
    }
  }
  return true;
}

// ─── Ejecutar una acción ─────────────────────────────────────
async function executeAction(
  organizationId: string,
  action: AutomationAction,
  data: Record<string, any>
): Promise<void> {
  switch (action.type) {
    case ACTION_TYPES.SEND_EMAIL: {
      const { sendEmailAndLog, emailTemplates } = await import('@/lib/email');
      const to = action.config.to || data.customer_email;
      const subject = action.config.subject || 'Notificación de RestoPanel';
      const template = action.config.template || 'notification';
      await sendEmailAndLog({
        to,
        subject,
        template: { html: action.config.html || `<p>${action.config.message || ''}</p>`, text: action.config.message || '' },
        organizationId,
      });
      break;
    }

    case ACTION_TYPES.SEND_WHATSAPP: {
      const { sendWhatsApp } = await import('@/lib/whatsapp');
      const to = action.config.to || data.customer_phone;
      const text = action.config.message || '';
      await sendWhatsApp({
        to,
        organizationId,
        text,
        type: action.config.template_name || 'automation',
        refId: data.reservation_id || data.customer_id,
      } as any);
      break;
    }

    case ACTION_TYPES.ADD_TAG: {
      if (data.customer_id) {
        const { data: customer } = await supabaseAdmin
          .from('customers')
          .select('tags')
          .eq('id', data.customer_id)
          .maybeSingle();
        const tags = new Set([...(customer?.tags || []), action.config.tag]);
        await supabaseAdmin
          .from('customers')
          .update({ tags: Array.from(tags), updated_at: new Date().toISOString() })
          .eq('id', data.customer_id);
      }
      break;
    }

    case ACTION_TYPES.REMOVE_TAG: {
      if (data.customer_id) {
        const { data: customer } = await supabaseAdmin
          .from('customers')
          .select('tags')
          .eq('id', data.customer_id)
          .maybeSingle();
        const tags = (customer?.tags || []).filter((t: string) => t !== action.config.tag);
        await supabaseAdmin
          .from('customers')
          .update({ tags, updated_at: new Date().toISOString() })
          .eq('id', data.customer_id);
      }
      break;
    }

    case ACTION_TYPES.CREATE_TASK: {
      await supabaseAdmin.from('notifications').insert({
        organization_id: organizationId,
        type: 'TASK',
        title: action.config.title || 'Nueva tarea',
        message: action.config.message || '',
        severity: action.config.severity || 'info',
        metadata: action.config.metadata || {},
      });
      break;
    }

    case ACTION_TYPES.NOTIFY_MANAGER: {
      await supabaseAdmin.from('notifications').insert({
        organization_id: organizationId,
        type: 'MANAGER_ALERT',
        title: action.config.title || 'Alerta de gerente',
        message: action.config.message || '',
        severity: action.config.severity || 'warning',
        metadata: action.config.metadata || {},
      });
      break;
    }

    case ACTION_TYPES.ADD_POINTS: {
      if (data.customer_id) {
        await supabaseAdmin.rpc('add_loyalty_points', {
          p_customer_id: data.customer_id,
          p_points: action.config.points || 0,
          p_reason: action.config.reason || 'automation',
        });
      }
      break;
    }

    case ACTION_TYPES.SET_VIP: {
      if (data.customer_id) {
        await supabaseAdmin
          .from('customers')
          .update({ vip_status: true, vip_since: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', data.customer_id);
      }
      break;
    }

    case ACTION_TYPES.CHANGE_PRIORITY: {
      if (data.waitlist_id) {
        await supabaseAdmin
          .from('waitlist')
          .update({ priority_score: action.config.priority || 50, updated_at: new Date().toISOString() })
          .eq('id', data.waitlist_id);
      }
      break;
    }

    default:
      logger.warn('Unknown automation action', 'automation', { action: action.type });
  }
}

// ─── Listar automatizaciones ─────────────────────────────────
export async function listAutomations(organizationId: string): Promise<Automation[]> {
  const { data, error } = await supabaseAdmin
    .from('automations')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []) as any;
}

// ─── Crear automatización ────────────────────────────────────
export async function createAutomation(
  organizationId: string,
  auto: Omit<Automation, 'id' | 'organization_id' | 'execution_count' | 'last_executed_at' | 'created_at' | 'updated_at'>
): Promise<Automation | null> {
  const { data, error } = await supabaseAdmin
    .from('automations')
    .insert({
      organization_id: organizationId,
      name: auto.name,
      description: auto.description,
      trigger_type: auto.trigger_type,
      trigger_config: auto.trigger_config,
      conditions: auto.conditions,
      actions: auto.actions,
      is_active: auto.is_active,
    })
    .select('*')
    .single();
  if (error) return null;
  return data as any;
}

// ─── Actualizar automatización ───────────────────────────────
export async function updateAutomation(
  organizationId: string,
  id: string,
  updates: Partial<Automation>
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('automations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', organizationId);
  return !error;
}

// ─── Eliminar automatización ─────────────────────────────────
export async function deleteAutomation(organizationId: string, id: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('automations')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);
  return !error;
}

// ─── Ejecuciones recientes ───────────────────────────────────
export async function getRecentExecutions(organizationId: string, limit: number = 20): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from('automation_executions')
    .select('*, automations(name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}
