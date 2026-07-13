"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, Plus, Zap, Clock, CheckCircle2, XCircle, Trash2, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const TRIGGER_LABELS: Record<string, string> = {
  "reservation.created": "Reserva creada",
  "reservation.confirmed": "Reserva confirmada",
  "reservation.cancelled": "Reserva cancelada",
  "reservation.completed": "Reserva completada",
  "reservation.no_show": "Cliente no show",
  "customer.birthday": "Cumpleaños del cliente",
  "customer.vip": "Cliente se hace VIP",
  "customer.anniversary": "Aniversario",
  "loyalty.tier_up": "Sube de nivel fidelización",
  "waitlist.seat": "Sentar desde lista espera",
  "no_show.threshold": "Umbral no-shows",
  "table.freed": "Mesa liberada",
  "low.occupation": "Ocupación baja",
  "high.occupation": "Ocupación alta",
};

const ACTION_LABELS: Record<string, string> = {
  send_email: "Enviar email",
  send_whatsapp: "Enviar WhatsApp",
  add_tag: "Añadir etiqueta",
  remove_tag: "Quitar etiqueta",
  create_task: "Crear tarea",
  notify_manager: "Notificar gerente",
  create_coupon: "Crear cupón",
  add_points: "Añadir puntos",
  change_priority: "Cambiar prioridad",
  set_vip: "Marcar VIP",
  reduce_priority: "Reducir prioridad",
};

const TRIGGER_ICONS: Record<string, string> = {
  "reservation.": "📅",
  "customer.": "👤",
  "loyalty.": "⭐",
  "waitlist.": "⏳",
  "no_show.": "⚠️",
  "table.": "🪑",
  "low.": "📉",
  "high.": "📈",
};

export function AutomationsSection() {
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: autoData, isLoading } = useQuery({
    queryKey: ["automations"],
    queryFn: () => api("/api/automations"),
  });
  const { data: execData } = useQuery({
    queryKey: ["automation-executions"],
    queryFn: () => api("/api/automations/executions"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api(`/api/automations/${id}`, { method: "PATCH", body: JSON.stringify({ is_active: active }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/automations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Automatización eliminada");
    },
  });

  const automations = (autoData as any)?.automations || [];
  const executions = (execData as any)?.executions || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Automatizaciones</h2>
          <p className="text-sm text-neutral-400 mt-0.5">Constructor de flujos tipo Make/Zapier</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]">
          <Plus className="w-4 h-4 mr-1.5" /> Nueva automatización
        </Button>
      </div>

      {/* Lista de automatizaciones */}
      {isLoading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#C5A059]" />
        </div>
      ) : automations.length === 0 ? (
        <div className="py-20 text-center">
          <Zap className="w-10 h-10 mx-auto mb-3 text-neutral-600" />
          <p className="text-sm text-neutral-500">No hay automatizaciones. Crea la primera.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((a: any) => (
            <div key={a.id} className="bg-[#111518] rounded-2xl border border-white/[0.06] p-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0",
                  a.is_active ? "bg-[#C5A059]/20" : "bg-white/5 grayscale"
                )}>
                  {TRIGGER_ICONS[Object.keys(TRIGGER_ICONS).find(k => a.trigger_type.startsWith(k)) || ""] || "⚡"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{a.name}</h3>
                    {!a.is_active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-500">INACTIVA</span>
                    )}
                  </div>
                  {a.description && <p className="text-xs text-neutral-500 mt-0.5">{a.description}</p>}
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                      {TRIGGER_LABELS[a.trigger_type] || a.trigger_type}
                    </span>
                    <span className="text-neutral-600">→</span>
                    {a.actions?.map((act: any, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-green-500/10 text-green-400">
                        {ACTION_LABELS[act.type] || act.type}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {a.execution_count || 0} ejecuciones
                    </span>
                    {a.last_executed_at && (
                      <span>Última: {new Date(a.last_executed_at).toLocaleDateString("es-ES")}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleMut.mutate({ id: a.id, active: !a.is_active })}
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition",
                      a.is_active ? "text-green-400 hover:bg-green-500/10" : "text-neutral-500 hover:bg-white/5"
                    )}
                    title={a.is_active ? "Desactivar" : "Activar"}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar "${a.name}"?`)) deleteMut.mutate(a.id);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ejecuciones recientes */}
      {executions.length > 0 && (
        <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Ejecuciones recientes</h3>
          <div className="space-y-2">
            {executions.slice(0, 10).map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                {e.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : e.status === "partial" ? (
                  <Clock className="w-4 h-4 text-orange-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{e.automations?.name || "Automatización"}</p>
                  <p className="text-[10px] text-neutral-500">
                    {new Date(e.created_at).toLocaleString("es-ES")} · {e.duration_ms}ms
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreate && <CreateAutomationDialog onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateAutomationDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("reservation.created");
  const [selectedActions, setSelectedActions] = useState<string[]>(["send_email"]);
  const [emailSubject, setEmailSubject] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      api("/api/automations", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: `Dispara en ${TRIGGER_LABELS[trigger]}`,
          trigger_type: trigger,
          trigger_config: {},
          conditions: [],
          actions: selectedActions.map(type => ({
            type,
            config: type === "send_email" ? { subject: emailSubject, message: emailSubject } : {},
          })),
          is_active: true,
        }),
      }),
    onSuccess: () => {
      toast.success("Automatización creada");
      qc.invalidateQueries({ queryKey: ["automations"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#1A1D24] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Nueva automatización</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Email de cumpleaños"
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Cuando sucede (trigger)</label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Acciones a ejecutar</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <label key={k} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10">
                  <input
                    type="checkbox"
                    checked={selectedActions.includes(k)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedActions([...selectedActions, k]);
                      else setSelectedActions(selectedActions.filter(a => a !== k));
                    }}
                    className="accent-[#C5A059]"
                  />
                  <span className="text-xs text-neutral-300">{v}</span>
                </label>
              ))}
            </div>
          </div>
          {selectedActions.includes("send_email") && (
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Asunto del email</label>
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Ej: ¡Feliz cumpleaños!"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-white/10 text-neutral-300">Cancelar</Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={!name || createMut.isPending}
            className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]"
          >
            {createMut.isPending ? "Creando..." : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
