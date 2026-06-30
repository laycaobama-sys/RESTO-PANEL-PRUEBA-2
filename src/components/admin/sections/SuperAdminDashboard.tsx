"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  Building2, Users, CalendarCheck, ClipboardList, Euro, Grid3x3,
  AlertTriangle, Crown, TrendingUp, TrendingDown, Activity,
  Award, AlertCircle, Info, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface StatsData {
  kpis: {
    tenants: { total: number; active: number; suspended: number; pending: number };
    users: { total: number; superAdmins: number };
    reservations: { today: number; yesterday: number; lastWeek: number; lastMonth: number; todayPax: number; delta: number };
    orders: { today: number; yesterday: number; total: number; delta: number };
    revenue: { today: number; yesterday: number; delta: number };
    catalog: { menuItems: number; tables: number; auditLogs: number };
    paxDelta: number;
  };
  timeSeries: { date: string; total: number; confirmed: number; cancelled: number }[];
  revenueSeries: { date: string; value: number }[];
  ranking: Array<{ organization: { id: string; name: string; slug: string; status: string }; reservations: number; revenue: number; cancelRate: number; pax: number }>;
  alerts: Array<{ type: string; severity: 'warning' | 'critical' | 'info'; message: string; tenantId?: string; tenantName?: string }>;
  statusDistribution: { name: string; value: number; color: string }[];
  shiftDistribution: { name: string; value: number; color: string }[];
  zoneDistribution: { name: string; value: number }[];
}

const RANGE_OPTIONS = [
  { id: '7', label: '7 días' },
  { id: '30', label: '30 días' },
  { id: '90', label: '90 días' },
];

export function SuperAdminDashboard() {
  const router = useRouter();
  const [range, setRange] = useState('30');

  const { data, isLoading } = useQuery<StatsData>({
    queryKey: ['admin-stats', range],
    queryFn: () => api(`/api/admin/stats?range=${range}`),
    refetchInterval: 60000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-neutral-500">
        <div className="animate-pulse">Cargando métricas globales...</div>
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className="space-y-5">
      {/* Header banner with range selector */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] rounded-2xl p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 flex-shrink-0" />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Panel de control global</h2>
            <p className="text-white/85 text-sm mt-0.5">
              Vigilancia completa de {k.tenants.total} empresas y {k.users.total} usuarios.
            </p>
          </div>
        </div>
        <div className="flex items-center bg-white/15 backdrop-blur rounded-lg p-1 self-start sm:self-auto">
          {RANGE_OPTIONS.map(o => (
            <button
              key={o.id}
              onClick={() => setRange(o.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                range === o.id ? 'bg-white text-[#C5A059]' : 'text-white hover:bg-white/10'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Empresas activas"
          value={k.tenants.active}
          hint={`${k.tenants.total} totales · ${k.tenants.suspended} suspendidas`}
          icon={<Building2 className="w-5 h-5" />}
          accent="green"
          delay={0}
        />
        <KpiCard
          label="Usuarios totales"
          value={k.users.total}
          hint={`${k.users.superAdmins} super admin`}
          icon={<Users className="w-5 h-5" />}
          accent="primary"
          delay={0.05}
        />
        <KpiCard
          label="Reservas hoy"
          value={k.reservations.today}
          hint={`${k.reservations.todayPax} comensales`}
          delta={k.reservations.delta}
          icon={<CalendarCheck className="w-5 h-5" />}
          accent="blue"
          delay={0.1}
        />
        <KpiCard
          label="Pedidos hoy"
          value={k.orders.today}
          hint={`${k.orders.total} totales`}
          delta={k.orders.delta}
          icon={<ClipboardList className="w-5 h-5" />}
          accent="indigo"
          delay={0.15}
        />
        <KpiCard
          label="Ingresos hoy"
          value={`${k.revenue.today.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`}
          hint={`Ayer: ${k.revenue.yesterday.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`}
          delta={k.revenue.delta}
          icon={<Euro className="w-5 h-5" />}
          accent="green"
          delay={0.2}
        />
        <KpiCard
          label="Reservas semana"
          value={k.reservations.lastWeek}
          hint={`Mes: ${k.reservations.lastMonth}`}
          icon={<CalendarCheck className="w-5 h-5" />}
          accent="yellow"
          delay={0.25}
        />
        <KpiCard
          label="Platos en catálogo"
          value={k.catalog.menuItems}
          hint={`${k.catalog.tables} mesas`}
          icon={<Grid3x3 className="w-5 h-5" />}
          accent="primary"
          delay={0.3}
        />
        <KpiCard
          label="Entradas auditoría"
          value={k.catalog.auditLogs}
          hint="Eventos registrados"
          icon={<Activity className="w-5 h-5" />}
          accent="red"
          delay={0.35}
        />
      </div>

      {/* Charts row 1: reservations time series + revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ChartCard
          title="Reservas por día"
          subtitle={`Últimos ${range} días · confirmadas vs canceladas`}
          className="lg:col-span-2"
          delay={0.4}
        >
          <div className="h-[260px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.timeSeries}>
                <defs>
                  <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cancGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  interval={Math.max(0, Math.floor(data.timeSeries.length / 8))}
                />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#71717a' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#16161a',
                    border: '1px solid #27272a',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#a1a1aa' }}
                  labelFormatter={(l) => new Date(l).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="confirmed" name="Confirmadas" stroke="#16a34a" strokeWidth={2} fill="url(#confGrad)" />
                <Area type="monotone" dataKey="cancelled" name="Canceladas" stroke="#ef4444" strokeWidth={2} fill="url(#cancGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Ingresos por día"
          subtitle={`Últimos ${range} días`}
          delay={0.45}
        >
          <div className="h-[260px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueSeries}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C5A059" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#C5A059" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => `${new Date(v).getDate()}/${new Date(v).getMonth() + 1}`}
                  tickLine={false} axisLine={false}
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  interval={Math.max(0, Math.floor(data.revenueSeries.length / 8))}
                />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={(v) => `${v}€`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#16161a', border: '1px solid #27272a', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#a1a1aa' }}
                  formatter={(v: any) => [`${Number(v).toLocaleString('es-ES')} €`, 'Ingresos']}
                />
                <Area type="monotone" dataKey="value" stroke="#C5A059" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Charts row 2: status + shift + zone distributions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ChartCard title="Estado de reservas" subtitle="Últimos 30 días" delay={0.5}>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.statusDistribution}
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                  isAnimationActive
                >
                  {data.statusDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#16161a', border: '1px solid #27272a', borderRadius: 12, fontSize: 12 }}
                  formatter={(v: any, n: any) => [`${v} reservas`, n]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Turnos" subtitle="Comida vs cena" delay={0.55}>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.shiftDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#71717a' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#16161a', border: '1px solid #27272a', borderRadius: 12, fontSize: 12 }}
                  cursor={{ fill: '#1f1f23' }}
                  formatter={(v: any) => [`${v} reservas`, '']}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {data.shiftDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Zonas" subtitle="Distribución por zona" delay={0.6}>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.zoneDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#71717a' }} width={60} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#16161a', border: '1px solid #27272a', borderRadius: 12, fontSize: 12 }}
                  cursor={{ fill: '#1f1f23' }}
                  formatter={(v: any) => [`${v} reservas`, '']}
                />
                <Bar dataKey="value" fill="#0EA5E9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Ranking + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Ranking */}
        <ChartCard
          title="Top restaurantes"
          subtitle={`Por reservas en últimos ${range} días`}
          icon={<Award className="w-4 h-4 text-yellow-500" />}
          className="lg:col-span-2"
          delay={0.65}
        >
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {data.ranking.length === 0 ? (
              <p className="text-sm text-neutral-500 py-8 text-center">No hay datos suficientes.</p>
            ) : (
              data.ranking.map((r, i) => (
                <motion.button
                  key={r.organization.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.03 }}
                  onClick={() => router.push(`/admin?tenant=${r.organization.id}`)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-[#1f1f23] hover:bg-[#27272a] transition-colors text-left"
                >
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
                    i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                    i === 1 ? 'bg-neutral-400/20 text-neutral-300' :
                    i === 2 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-neutral-700/40 text-neutral-500'
                  )}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.organization.name}</p>
                    <p className="text-xs text-neutral-500">
                      {r.reservations} reservas · {r.pax} comensales · {r.revenue.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.cancelRate >= 30 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                        {r.cancelRate}% canc.
                      </span>
                    )}
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded uppercase',
                      r.organization.status === 'ACTIVE' ? 'bg-green-500/15 text-green-400' :
                      r.organization.status === 'SUSPENDED' ? 'bg-red-500/15 text-red-400' :
                      'bg-yellow-500/15 text-yellow-400'
                    )}>
                      {r.organization.status}
                    </span>
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </ChartCard>

        {/* Alerts */}
        <ChartCard
          title="Alertas del sistema"
          subtitle={`${data.alerts.length} incidencias detectadas`}
          icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
          delay={0.7}
        >
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {data.alerts.length === 0 ? (
              <div className="text-center py-8">
                <ShieldCheck className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-neutral-400">Sin alertas. Todo OK.</p>
              </div>
            ) : (
              data.alerts.slice(0, 8).map((a, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.75 + i * 0.04 }}
                  className={cn(
                    'flex items-start gap-2 p-2.5 rounded-lg border',
                    a.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                    a.severity === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                    'bg-blue-500/10 border-blue-500/30'
                  )}
                >
                  {a.severity === 'critical' ? <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" /> :
                   a.severity === 'warning' ? <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" /> :
                   <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white">{a.tenantName || 'Sistema'}</p>
                    <p className="text-xs text-neutral-400">{a.message}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

const ACCENT_BG: Record<string, string> = {
  primary: 'bg-[#C5A059]/15 text-[#C5A059]',
  green: 'bg-green-500/15 text-green-400',
  blue: 'bg-blue-500/15 text-blue-400',
  yellow: 'bg-yellow-500/15 text-yellow-400',
  red: 'bg-red-500/15 text-red-400',
  indigo: 'bg-indigo-500/15 text-indigo-400',
};

function KpiCard({
  label, value, hint, delta, icon, accent, delay,
}: {
  label: string; value: string | number; hint?: string; delta?: number;
  icon: React.ReactNode; accent: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2 }}
      className="bg-[#16161a] rounded-xl border border-[#27272a] p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', ACCENT_BG[accent])}>
          {icon}
        </div>
        {typeof delta === 'number' && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded',
            delta >= 0 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
          )}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
      {hint && <p className="text-[10px] text-neutral-600 mt-0.5">{hint}</p>}
    </motion.div>
  );
}

function ChartCard({
  title, subtitle, icon, className, delay = 0, children,
}: {
  title: string; subtitle?: string; icon?: React.ReactNode; className?: string;
  delay?: number; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn('bg-[#16161a] rounded-2xl border border-[#27272a] p-4 sm:p-5', className)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
          </div>
        </div>
      </div>
      {children}
    </motion.div>
  );
}
