"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api"; import { formatCurrency } from "@/lib/format";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { StatCard } from "@/components/shared/StatCard";
import {
  Euro,
  ShoppingBag,
  TrendingUp,
  Clock,
  Flame,
  Award,
  Calendar,
} from "lucide-react";
import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

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
  daily: { date: string; revenue: number; orders: number }[];
  monthly: { date: string; revenue: number }[];
  topItems: { name: string; image: string | null; price: number; quantity: number }[];
  hourly: { hour: string; count: number }[];
  tablesSummary: { total: number; available: number; occupied: number; reserved: number; preparing: number };
  avgPrepTimeMinutes: number;
}

const COLORS = ["#FF6B35", "#4CAF50", "#2196F3", "#FFC107", "#A855F7", "#EF4444"];

export function AnalyticsSection() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: () => api("/api/analytics"),
  });

  const dailyData = (data?.daily || []).map((d) => ({
    label: new Date(d.date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }),
    ...d,
  }));
  const monthlyData = (data?.monthly || []).map((d) => ({
    label: new Date(d.date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }),
    ...d,
  }));
  const chartData = period === "week" ? dailyData : monthlyData;

  const statusDistribution = data
    ? [
        { name: "Completados", value: data.today.completed, color: "#16a34a" },
        { name: "Servidos", value: data.today.served, color: "#6366f1" },
        { name: "Preparando", value: data.today.preparing, color: "#3b82f6" },
        { name: "Pendientes", value: data.today.pending, color: "#eab308" },
        { name: "Cancelados", value: data.today.cancelled, color: "#ef4444" },
      ].filter((s) => s.value > 0)
    : [];

  const weekTotal = data?.daily.reduce((s, d) => s + d.revenue, 0) || 0;
  const weekOrders = data?.daily.reduce((s, d) => s + d.orders, 0) || 0;
  const monthTotal = data?.monthly.reduce((s, d) => s + d.revenue, 0) || 0;
  const peakHour = data?.hourly.reduce(
    (max, h) => (h.count > max.count ? h : max),
    { hour: "—", count: 0 }
  );

  return (
    <div>
      <SectionHeader
        title="Analíticas"
        subtitle="Rendimiento de tu restaurante en cifras"
        actions={
          <div className="flex items-center bg-white border border-[#ececed] rounded-lg p-1">
            <button
              onClick={() => setPeriod("week")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md",
                period === "week" ? "bg-[#FF6B35] text-white" : "text-neutral-600"
              )}
            >
              Semana
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md",
                period === "month" ? "bg-[#FF6B35] text-white" : "text-neutral-600"
              )}
            >
              Mes
            </button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard
          label={period === "week" ? "Ventas semana" : "Ventas mes"}
          value={formatCurrency(period === "week" ? weekTotal : monthTotal)}
          icon={<Euro className="w-5 h-5" />}
          accent="green"
          trend={12}
        />
        <StatCard
          label={period === "week" ? "Pedidos semana" : "Pedidos mes"}
          value={period === "week" ? weekOrders : data?.monthly.length || 0}
          icon={<ShoppingBag className="w-5 h-5" />}
          accent="primary"
          trend={8}
        />
        <StatCard
          label="Ticket medio"
          value={formatCurrency(data?.today.avgTicket || 0)}
          icon={<TrendingUp className="w-5 h-5" />}
          accent="blue"
          trend={4}
        />
        <StatCard
          label="Hora punta"
          value={peakHour?.hour || "—"}
          icon={<Clock className="w-5 h-5" />}
          accent="yellow"
          hint={`${peakHour?.count || 0} pedidos en esa hora`}
        />
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-2xl border border-[#ececed] p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-neutral-900">
              Evolución de ventas
            </h3>
            <p className="text-xs text-neutral-500">
              {period === "week" ? "Últimos 7 días" : "Últimos 30 días"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-500">Total periodo</p>
            <p className="text-xl font-bold text-neutral-900">
              {formatCurrency(period === "week" ? weekTotal : monthTotal)}
            </p>
          </div>
        </div>
        <div className="h-[280px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#FF6B35" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                interval={period === "month" ? 4 : 0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickFormatter={(v) => `${v}€`}
              />
              <Tooltip
                formatter={(v: any) => [formatCurrency(v), "Ventas"]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #ececed",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#FF6B35"
                strokeWidth={2.5}
                fill="url(#revGrad2)"
                dot={{ r: 3, fill: "#FF6B35", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Top items */}
        <div className="bg-white rounded-2xl border border-[#ececed] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-[#FF6B35]" />
            <h3 className="font-semibold text-neutral-900">Top platos</h3>
          </div>
          <div className="space-y-3">
            {(data?.topItems || []).slice(0, 6).map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
                  i === 0 ? "bg-yellow-100 text-yellow-700" :
                  i === 1 ? "bg-gray-100 text-gray-700" :
                  i === 2 ? "bg-orange-100 text-orange-700" :
                  "bg-neutral-100 text-neutral-500"
                )}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {item.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#FF6B35] rounded-full"
                        style={{
                          width: `${Math.min(100, (item.quantity / (data?.topItems[0]?.quantity || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-neutral-700">
                      {item.quantity}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status distribution */}
        <div className="bg-white rounded-2xl border border-[#ececed] p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="w-4 h-4 text-[#FF6B35]" />
            <h3 className="font-semibold text-neutral-900">Estado de pedidos hoy</h3>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any, n: any) => [`${v} pedidos`, n]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #ececed",
                    fontSize: 12,
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly */}
        <div className="bg-white rounded-2xl border border-[#ececed] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-[#FF6B35]" />
            <h3 className="font-semibold text-neutral-900">Horas punta</h3>
          </div>
          <div className="h-[200px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.hourly || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f3" />
                <XAxis
                  dataKey="hour"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 9, fill: "#9ca3af" }}
                  interval={1}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                />
                <Tooltip
                  formatter={(v: any) => [`${v} pedidos`, ""]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #ececed",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="#FF6B35" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Efficiency metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#ececed] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <p className="text-sm text-neutral-500">Tiempo medio preparación</p>
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {data?.avgPrepTimeMinutes || 0} min
          </p>
          <p className="text-xs text-neutral-400 mt-1">Objetivo: 12 min</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#ececed] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-green-500" />
            <p className="text-sm text-neutral-500">Tasa de completado</p>
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {data?.today.totalOrders
              ? Math.round((data.today.completed / data.today.totalOrders) * 100)
              : 0}
            %
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {data?.today.completed} de {data?.today.totalOrders} pedidos
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#ececed] p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[#FF6B35]" />
            <p className="text-sm text-neutral-500">Rotación de mesas</p>
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {data?.tablesSummary.total
              ? (data.today.totalOrders / data.tablesSummary.total).toFixed(1)
              : "0"}
            x
          </p>
          <p className="text-xs text-neutral-400 mt-1">Pedidos/mesa hoy</p>
        </div>
      </div>
    </div>
  );
}
