"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, ScrollText, Filter } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  actor_email: string;
  actor_role: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  organization_id: string | null;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const ACTION_FILTERS = [
  { id: "ALL", label: "Todas" },
  { id: "IMPERSONATE_START", label: "Impersonación inicio" },
  { id: "IMPERSONATE_END", label: "Impersonación fin" },
  { id: "TENANT_SUSPEND", label: "Empresas suspendidas" },
  { id: "TENANT_ACTIVATE", label: "Empresas activadas" },
];

export function AuditLogsSection() {
  const [actionFilter, setActionFilter] = useState("ALL");

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["admin-logs", actionFilter],
    queryFn: () => {
      const qs = actionFilter !== "ALL" ? `?action=${actionFilter}` : "";
      return api(`/api/admin/logs${qs}`);
    },
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-[#16161a] rounded-xl border border-[#27272a] p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-neutral-400 px-2">
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filtrar por acción:</span>
        </div>
        {ACTION_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActionFilter(f.id)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors border",
              actionFilter === f.id
                ? "bg-[#C5A059] text-white border-[#C5A059]"
                : "bg-[#1f1f23] text-neutral-400 border-[#27272a] hover:bg-[#27272a]"
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-neutral-500 ml-auto">{logs.length} registro(s)</span>
      </div>

      {/* Logs list */}
      {isLoading ? (
        <div className="py-12 flex items-center justify-center text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-[#16161a] rounded-2xl border border-[#27272a] py-12 text-center text-neutral-500">
          <ScrollText className="w-10 h-10 mx-auto mb-2 opacity-50" />
          No hay registros de auditoría para este filtro.
        </div>
      ) : (
        <div className="bg-[#16161a] rounded-xl border border-[#27272a] overflow-hidden">
          <div className="divide-y divide-[#27272a]">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-[#1f1f23] transition-colors">
                <div className="flex items-start gap-3">
                  <ActionBadge action={log.action} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {formatAction(log.action)}
                          {log.target_name && (
                            <span className="text-neutral-400"> · {log.target_name}</span>
                          )}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          <span className="font-medium text-neutral-400">{log.actor_email}</span>
                          {" · "}
                          <span className="text-neutral-500">{log.actor_role}</span>
                          {log.ip_address && (
                            <>
                              {" · "}
                              <span className="font-mono text-neutral-600">{log.ip_address}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <span className="text-xs text-neutral-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                    {log.details && (
                      <pre className="mt-2 p-2 bg-[#0f0f12] rounded text-[10px] text-neutral-400 overflow-x-auto font-mono">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  let cls = "bg-neutral-500/15 text-neutral-400";
  if (action.startsWith("IMPERSONATE")) cls = "bg-purple-500/15 text-purple-400";
  else if (action.startsWith("TENANT_SUSPEND")) cls = "bg-red-500/15 text-red-400";
  else if (action.startsWith("TENANT_ACTIVATE")) cls = "bg-green-500/15 text-green-400";
  else if (action.includes("DELETE")) cls = "bg-red-500/15 text-red-400";
  else if (action.includes("CREATE")) cls = "bg-green-500/15 text-green-400";
  else if (action.includes("UPDATE")) cls = "bg-blue-500/15 text-blue-400";

  return (
    <span className={cn("text-[10px] font-bold px-2 py-1 rounded uppercase whitespace-nowrap h-fit", cls)}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    IMPERSONATE_START: "Super admin entró como cliente",
    IMPERSONATE_END: "Super admin salió del modo cliente",
    TENANT_SUSPEND: "Empresa suspendida",
    TENANT_ACTIVATE: "Empresa activada",
    TENANT_SET_PENDING: "Empresa marcada como pendiente",
    LOGIN: "Inicio de sesión",
    LOGOUT: "Cierre de sesión",
    REGISTER: "Registro de nueva empresa",
  };
  return map[action] || action.replace(/_/g, ' ').toLowerCase();
}
