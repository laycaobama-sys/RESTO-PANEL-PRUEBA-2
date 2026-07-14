"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, TrendingUp, Users, Calendar, DollarSign, AlertCircle, Crown, Cake, Clock, Activity, Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function ExecutiveDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["executive-dashboard"],
    queryFn: () => api("/api/dashboard/executive"),
    
  });

  if (isLoading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#C5A059]" />
      </div>
    );
  }

  const d = data as any;
  if (!d) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard ejecutivo</h2>
          <p className="text-sm text-neutral-400 mt-0.5">
            {new Date(d.date).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Ingresos hoy"
          value={`${d.revenue.total.toFixed(2)}€`}
          sub={`${d.revenue.upsells.toFixed(2)}€ en upselling`}
          color="green"
        />
        <KpiCard
          icon={<Calendar className="w-5 h-5" />}
          label="Reservas activas"
          value={d.reservations.today}
          sub={`${d.reservations.completed} completadas`}
          color="blue"
        />
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          label="Comensales"
          value={d.covers}
          sub={`${d.customers.recurring} recurrentes`}
          color="purple"
        />
        <KpiCard
          icon={<Clock className="w-5 h-5" />}
          label="Estancia media"
          value={`${d.avg_stay_min} min`}
          sub={`${d.tables.free} mesas libres`}
          color="orange"
        />
      </div>

      {/* Alertas y notificaciones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AlertCard
          icon={<AlertCircle className="w-4 h-4" />}
          title="No-shows"
          value={d.reservations.no_shows}
          color="red"
        />
        <AlertCard
          icon={<AlertCircle className="w-4 h-4" />}
          title="Cancelaciones"
          value={d.reservations.cancelled}
          color="orange"
        />
        <AlertCard
          icon={<Activity className="w-4 h-4" />}
          title="Lista de espera"
          value={d.waitlist.waiting}
          sub={`${d.waitlist.seated} sentados`}
          color="blue"
        />
      </div>

      {/* Clientes destacados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-[#C5A059]" />
            <h3 className="text-sm font-semibold text-white">Clientes VIP hoy</h3>
          </div>
          <p className="text-3xl font-bold text-[#C5A059]">{d.customers.vip_today}</p>
          <p className="text-xs text-neutral-500 mt-1">con reserva confirmada</p>
        </div>

        <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Cake className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-semibold text-white">Cumpleaños hoy</h3>
          </div>
          <p className="text-3xl font-bold text-pink-400">{d.customers.birthdays_today}</p>
          <p className="text-xs text-neutral-500 mt-1">oportunidades de fidelización</p>
        </div>
      </div>

      {/* Canales de adquisición */}
      <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-[#C5A059]" />
          <h3 className="text-sm font-semibold text-white">Reservas por canal</h3>
        </div>
        <div className="space-y-2">
          {Object.entries(d.channels).map(([channel, count]) => {
            const total = Object.values(d.channels).reduce((a: number, b: any) => a + Number(b), 0);
            const pct = total > 0 ? (Number(count) / total) * 100 : 0;
            const labels: Record<string, string> = {
              web: "Web", google: "Google", instagram: "Instagram",
              whatsapp: "WhatsApp", phone: "Teléfono", walk_in: "Walk-in", unknown: "Otro",
            };
            return (
              <div key={channel} className="flex items-center gap-3">
                <span className="text-xs text-neutral-400 w-24">{labels[channel] || channel}</span>
                <div className="flex-1 h-6 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#C5A059] rounded-full flex items-center justify-end px-2"
                    style={{ width: `${pct}%` }}
                  >
                    <span className="text-[10px] font-bold text-[#0a0a0a]">{String(count)}</span>
                  </div>
                </div>
                <span className="text-xs text-neutral-500 w-12 text-right">{pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Nuevos vs recurrentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-semibold text-white">Nuevos clientes (mes)</h3>
          </div>
          <p className="text-3xl font-bold text-yellow-400">{d.customers.new_this_month}</p>
        </div>
        <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white">Clientes recurrentes</h3>
          </div>
          <p className="text-3xl font-bold text-red-400">{d.customers.recurring}</p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: any; sub?: string; color: string;
}) {
  const colors: Record<string, string> = {
    green: "text-green-400 bg-green-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    orange: "text-orange-400 bg-orange-500/10",
  };
  return (
    <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-neutral-400 uppercase tracking-wide">{label}</span>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", colors[color])}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-neutral-500 mt-1">{sub}</p>}
    </div>
  );
}

function AlertCard({ icon, title, value, sub, color }: {
  icon: React.ReactNode; title: string; value: any; sub?: string; color: string;
}) {
  const colors: Record<string, string> = {
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    orange: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  };
  return (
    <div className={cn("rounded-2xl border p-4 flex items-center gap-3", colors[color])}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/5">
        {icon}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide opacity-70">{title}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
      {sub && <span className="ml-auto text-xs opacity-60">{sub}</span>}
    </div>
  );
}
