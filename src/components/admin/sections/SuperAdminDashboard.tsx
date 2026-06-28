"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Building2,
  Users,
  UtensilsCrossed,
  Grid3x3,
  CalendarCheck,
  ClipboardList,
  ScrollText,
  Activity,
  AlertCircle,
  Shield,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlobalStats {
  tenants: { total: number; active: number; suspended: number; pending: number };
  users: { total: number; superAdmins: number };
  menuItems: number;
  tables: number;
  reservations: number;
  orders: number;
  auditLogs: number;
}
interface AuditLog {
  id: string;
  actor_email: string;
  actor_role: string;
  action: string;
  target_name: string | null;
  created_at: string;
}

export function SuperAdminDashboard() {
  const { data, isLoading } = useQuery<{ stats: GlobalStats; activity: AuditLog[] }>({
    queryKey: ["admin-stats"],
    queryFn: () => api("/api/admin/stats"),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return <div className="text-neutral-500">Cargando resumen global...</div>;
  }

  const stats = data?.stats;
  const activity = data?.activity || [];

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-gradient-to-br from-[#FF6B35] to-[#D43A12] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Panel de control global</h2>
        </div>
        <p className="text-white/85">
          Vista de dueño del sistema. Desde aquí controlas todos los restaurantes,
          usuarios y la auditoría completa. Todas las acciones que realices quedarán
          registradas.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Empresas activas"
          value={`${stats?.tenants.active ?? 0}/${stats?.tenants.total ?? 0}`}
          icon={<Building2 className="w-5 h-5" />}
          accent="green"
          delay={0}
        />
        <KpiCard
          label="Usuarios totales"
          value={stats?.users.total ?? 0}
          hint={`${stats?.users.superAdmins ?? 0} super admin`}
          icon={<Users className="w-5 h-5" />}
          accent="primary"
          delay={0.05}
        />
        <KpiCard
          label="Platos en catálogo"
          value={stats?.menuItems ?? 0}
          icon={<UtensilsCrossed className="w-5 h-5" />}
          accent="blue"
          delay={0.1}
        />
        <KpiCard
          label="Mesas configuradas"
          value={stats?.tables ?? 0}
          icon={<Grid3x3 className="w-5 h-5" />}
          accent="indigo"
          delay={0.15}
        />
        <KpiCard
          label="Reservas totales"
          value={stats?.reservations ?? 0}
          icon={<CalendarCheck className="w-5 h-5" />}
          accent="yellow"
          delay={0.2}
        />
        <KpiCard
          label="Pedidos totales"
          value={stats?.orders ?? 0}
          icon={<ClipboardList className="w-5 h-5" />}
          accent="primary"
          delay={0.25}
        />
        <KpiCard
          label="Entradas de auditoría"
          value={stats?.auditLogs ?? 0}
          icon={<ScrollText className="w-5 h-5" />}
          accent="red"
          delay={0.3}
        />
        <KpiCard
          label="Empresas suspendidas"
          value={stats?.tenants.suspended ?? 0}
          icon={<AlertCircle className="w-5 h-5" />}
          accent="red"
          delay={0.35}
        />
      </div>

      {/* Recent activity */}
      <div className="bg-[#16161a] rounded-2xl border border-[#27272a] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#FF6B35]" />
          <h3 className="font-semibold">Actividad reciente</h3>
          <span className="text-xs text-neutral-500">últimas 20 acciones</span>
        </div>
        {activity.length === 0 ? (
          <p className="text-sm text-neutral-500 py-6 text-center">
            Todavía no hay actividad registrada.
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {activity.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-[#1f1f23] hover:bg-[#27272a] transition-colors"
              >
                <ActionBadge action={log.action} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {formatAction(log.action)}
                    {log.target_name && (
                      <span className="text-neutral-400"> · {log.target_name}</span>
                    )}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {log.actor_email} · {log.actor_role}
                  </p>
                </div>
                <span className="text-xs text-neutral-500 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ACCENT_BG: Record<string, string> = {
  primary: "bg-[#FF6B35]/15 text-[#FF6B35]",
  green: "bg-green-500/15 text-green-400",
  blue: "bg-blue-500/15 text-blue-400",
  yellow: "bg-yellow-500/15 text-yellow-400",
  red: "bg-red-500/15 text-red-400",
  indigo: "bg-indigo-500/15 text-indigo-400",
};

function KpiCard({
  label,
  value,
  hint,
  icon,
  accent,
  delay,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  accent: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-[#16161a] rounded-2xl border border-[#27272a] p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", ACCENT_BG[accent])}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
      {hint && <p className="text-[10px] text-neutral-600 mt-0.5">{hint}</p>}
    </motion.div>
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
    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded uppercase whitespace-nowrap", cls)}>
      {action.split('_')[0]}
    </span>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    IMPERSONATE_START: "Empezó a ver como cliente",
    IMPERSONATE_END: "Salió del modo cliente",
    TENANT_SUSPEND: "Suspendió empresa",
    TENANT_ACTIVATE: "Activó empresa",
    TENANT_SET_PENDING: "Marcó empresa como pendiente",
    LOGIN: "Inició sesión",
    LOGOUT: "Cerró sesión",
    REGISTER: "Registró nueva empresa",
  };
  return map[action] || action.replace(/_/g, ' ').toLowerCase();
}
