"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api"; import { formatCurrency } from "@/lib/format";
import { StatCard } from "@/components/shared/StatCard";
import { SectionHeader } from "@/components/shared/SectionHeader";
import {
  OrderStatusBadge,
  ZONE_LABEL,
} from "@/components/shared/StatusBadge";
import {
  ClipboardList,
  Euro,
  Clock,
  CheckCircle2,
  TrendingUp,
  Utensils,
  Users,
  Grid3x3,
  ArrowUpRight,
  Flame,
} from "lucide-react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

interface AnalyticsData {
  today: {
    totalOrders: number;
    pending: number;
    preparing: number;
    served: number;
    completed: number;
    cancelled: number;
    revenue: number;
    avgTicket: number;
  };
  todayReservations: {
    total: number;
    lunch: { total: number; confirmed: number; pax: number };
    dinner: { total: number; confirmed: number; pax: number };
    confirmed: number;
    pending: number;
    cancelled: number;
    noShow: number;
    totalPax: number;
  };
  occupancyByDay: { date: string; lunch: number; dinner: number; total: number }[];
  noShowRate: number;
  occupancyRate: number;
  daily: { date: string; revenue: number; orders: number }[];
  monthly: { date: string; revenue: number }[];
  topItems: {
    name: string;
    image: string | null;
    price: number;
    quantity: number;
  }[];
  hourly: { hour: string; count: number }[];
  tablesSummary: {
    total: number;
    available: number;
    occupied: number;
    reserved: number;
    preparing: number;
  };
  avgPrepTimeMinutes: number;
}

export function DashboardSection() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: () => api("/api/analytics"),
  });
  const setSection = useAppStore((s) => s.setSection);

  const today = data?.today;
  const maxRevenue = Math.max(...(data?.daily.map((d) => d.revenue) || [1]), 1);
  const maxHourly = Math.max(...(data?.hourly.map((h) => h.count) || [1]), 1);

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Hola, ${today ? "esto es lo de hoy" : "cargando..."}`}
        subtitle="Resumen de actividad de tu restaurante"
        actions={
          <Button
            className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white"
            onClick={() => setSection("orders")}
          >
            <ClipboardList className="w-4 h-4 mr-1.5" />
            Ver pedidos
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Pedidos hoy"
          value={today?.totalOrders ?? "—"}
          icon={<ClipboardList className="w-5 h-5" />}
          accent="primary"
          trend={8}
          delay={0}
        />
        <StatCard
          label="Ventas hoy"
          value={today ? formatCurrency(today.revenue) : "—"}
          icon={<Euro className="w-5 h-5" />}
          accent="green"
          trend={12}
          delay={0.05}
        />
        <StatCard
          label="Pendientes"
          value={today?.pending ?? "—"}
          icon={<Clock className="w-5 h-5" />}
          accent="yellow"
          hint={`${today?.preparing ?? 0} preparándose`}
          delay={0.1}
        />
        <StatCard
          label="Completados"
          value={today?.completed ?? "—"}
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="indigo"
          hint={`${today?.cancelled ?? 0} cancelados`}
          delay={0.15}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Ticket medio"
          value={today ? formatCurrency(today.avgTicket) : "—"}
          icon={<TrendingUp className="w-5 h-5" />}
          accent="blue"
          delay={0.2}
        />
        <StatCard
          label="Tiempo medio prep."
          value={`${data?.avgPrepTimeMinutes ?? "—"} min`}
          icon={<Flame className="w-5 h-5" />}
          accent="red"
          delay={0.25}
        />
        <StatCard
          label="Mesas ocupadas"
          value={`${data?.tablesSummary.occupied ?? 0}/${data?.tablesSummary.total ?? 0}`}
          icon={<Grid3x3 className="w-5 h-5" />}
          accent="primary"
          hint={`${data?.tablesSummary.available ?? 0} libres`}
          delay={0.3}
        />
        <StatCard
          label="Reservas activas"
          value={data?.tablesSummary.reserved ?? 0}
          icon={<Users className="w-5 h-5" />}
          accent="yellow"
          delay={0.35}
        />
      </div>

      {/* Today's services: lunch / dinner breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="bg-white rounded-2xl border border-[#ececed] p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-neutral-900">Servicios de hoy</h3>
            <p className="text-xs text-neutral-500">Comida y cena · reservas confirmadas</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-neutral-600">
              <span className="w-2 h-2 rounded-full bg-[#FF6B35]" /> Comida
            </span>
            <span className="flex items-center gap-1.5 text-neutral-600">
              <span className="w-2 h-2 rounded-full bg-[#0EA5E9]" /> Cena
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ServiceCard
            title="Servicio de comida"
            total={data?.todayReservations?.lunch?.total ?? 0}
            confirmed={data?.todayReservations?.lunch?.confirmed ?? 0}
            pax={data?.todayReservations?.lunch?.pax ?? 0}
            color="primary"
          />
          <ServiceCard
            title="Servicio de cena"
            total={data?.todayReservations?.dinner?.total ?? 0}
            confirmed={data?.todayReservations?.dinner?.confirmed ?? 0}
            pax={data?.todayReservations?.dinner?.pax ?? 0}
            color="blue"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#ececed]">
          <MiniStat label="Confirmadas" value={data?.todayReservations?.confirmed ?? 0} cls="text-green-600" />
          <MiniStat label="Pendientes" value={data?.todayReservations?.pending ?? 0} cls="text-yellow-600" />
          <MiniStat label="Canceladas" value={data?.todayReservations?.cancelled ?? 0} cls="text-red-600" />
          <MiniStat label="No-shows" value={data?.todayReservations?.noShow ?? 0} cls="text-purple-600" />
        </div>
      </motion.div>

      {/* Tertiary KPIs: no-show rate + occupancy */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Tasa no-show (7d)"
          value={`${data?.noShowRate ?? 0}%`}
          icon={<Users className="w-5 h-5" />}
          accent="red"
          delay={0.45}
        />
        <StatCard
          label="Ocupación actual"
          value={`${data?.occupancyRate ?? 0}%`}
          icon={<Grid3x3 className="w-5 h-5" />}
          accent="primary"
          delay={0.5}
        />
        <StatCard
          label="Comensales hoy"
          value={data?.todayReservations?.totalPax ?? 0}
          icon={<Users className="w-5 h-5" />}
          accent="blue"
          delay={0.55}
        />
        <StatCard
          label="Reservas hoy"
          value={data?.todayReservations?.total ?? 0}
          icon={<ClipboardList className="w-5 h-5" />}
          accent="yellow"
          delay={0.6}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="lg:col-span-2 bg-white rounded-2xl border border-[#ececed] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-neutral-900">
                Ventas últimos 7 días
              </h3>
              <p className="text-xs text-neutral-500">
                Ingresos por día (servidos + completados)
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500">Total semana</p>
              <p className="text-lg font-bold text-neutral-900">
                {formatCurrency(
                  data?.daily.reduce((s, d) => s + d.revenue, 0) || 0
                )}
              </p>
            </div>
          </div>
          <div className="h-[260px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.daily || []}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#FF6B35" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f1f3"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={(v) => `${v}€`}
                />
                <Tooltip
                  formatter={(v: any) => [formatCurrency(v), "Ventas"]}
                  labelFormatter={(l) => {
                    const d = new Date(l);
                    return d.toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    });
                  }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #ececed",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#FF6B35"
                  strokeWidth={2.5}
                  fill="url(#revGrad)"
                  dot={{ r: 4, fill: "#FF6B35", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top items */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.45 }}
          className="bg-white rounded-2xl border border-[#ececed] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-neutral-900">Top platos</h3>
              <p className="text-xs text-neutral-500">Más vendidos (7 días)</p>
            </div>
            <Utensils className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="space-y-3">
            {(data?.topItems || []).slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-xs font-semibold text-neutral-500">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {item.quantity} uds · {formatCurrency(item.price)}
                  </p>
                </div>
                <div className="text-sm font-semibold text-[#FF6B35]">
                  {item.quantity}
                </div>
              </div>
            ))}
            {!data?.topItems?.length && (
              <p className="text-sm text-neutral-400 text-center py-8">
                Sin datos aún
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Hourly peak + Tables summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="lg:col-span-2 bg-white rounded-2xl border border-[#ececed] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-neutral-900">Horas punta</h3>
              <p className="text-xs text-neutral-500">
                Distribución de pedidos por hora (7 días)
              </p>
            </div>
            <Clock className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="h-[220px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.hourly || []}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f1f3"
                />
                <XAxis
                  dataKey="hour"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  interval={1}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                />
                <Tooltip
                  formatter={(v: any) => [`${v} pedidos`, ""]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #ececed",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="#FF6B35" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Tables */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.55 }}
          className="bg-white rounded-2xl border border-[#ececed] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-neutral-900">Estado de mesas</h3>
            <button
              onClick={() => setSection("tables")}
              className="text-xs text-[#FF6B35] font-medium flex items-center gap-0.5 hover:underline"
            >
              Ver todas <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat
              label="Libres"
              value={data?.tablesSummary.available ?? 0}
              cls="bg-green-50 text-green-700"
            />
            <MiniStat
              label="Ocupadas"
              value={data?.tablesSummary.occupied ?? 0}
              cls="bg-red-50 text-red-700"
            />
            <MiniStat
              label="Reservadas"
              value={data?.tablesSummary.reserved ?? 0}
              cls="bg-yellow-50 text-yellow-700"
            />
            <MiniStat
              label="Preparando"
              value={data?.tablesSummary.preparing ?? 0}
              cls="bg-blue-50 text-blue-700"
            />
          </div>
          <div className="mt-4 pt-4 border-t border-[#ececed]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Ocupación</span>
              <span className="font-semibold text-neutral-900">
                {data?.tablesSummary.total
                  ? Math.round(
                      ((data.tablesSummary.occupied +
                        data.tablesSummary.preparing) /
                        data.tablesSummary.total) *
                        100
                    )
                  : 0}
                %
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-neutral-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${
                    data?.tablesSummary.total
                      ? Math.round(
                          ((data.tablesSummary.occupied +
                            data.tablesSummary.preparing) /
                            data.tablesSummary.total) *
                            100
                        )
                      : 0
                  }%`,
                }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-[#FF6B35] to-[#F94B1E] rounded-full"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  cls,
}: {
  label: string;
  value: number;
  cls: string;
}) {
  return (
    <div className={`rounded-xl p-3 ${cls}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}

function ServiceCard({
  title,
  total,
  confirmed,
  pax,
  color,
}: {
  title: string;
  total: number;
  confirmed: number;
  pax: number;
  color: "primary" | "blue";
}) {
  const accentBg = color === "primary" ? "bg-[#FFF3ED] text-[#FF6B35]" : "bg-blue-50 text-blue-600";
  const barColor = color === "primary" ? "bg-[#FF6B35]" : "bg-[#0EA5E9]";
  const rate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-[#ececed] p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accentBg}`}>
          <Clock className="w-4.5 h-4.5" />
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-neutral-900">{confirmed}/{total}</p>
          <p className="text-xs text-neutral-500">confirmadas</p>
        </div>
      </div>
      <p className="font-medium text-neutral-900 text-sm">{title}</p>
      <p className="text-xs text-neutral-500 mt-0.5">{pax} comensales esperados</p>
      <div className="mt-2 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all`}
          style={{ width: `${rate}%` }}
        />
      </div>
    </div>
  );
}
