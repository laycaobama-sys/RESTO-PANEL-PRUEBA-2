"use client";

import { useQuery } from "@tanstack/react-query";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Loader2, TrendingUp, Users, Building2, DollarSign, AlertCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function BillingAdminSection() {
  const [filter, setFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-billing"],
    queryFn: async () => {
      // Get all org subscriptions with plan info
      const { data: subs } = await fetch("/api/admin/billing").then(r => r.json());
      return subs || [];
    },
  });

  if (isLoading) {
    return <div className="py-12 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#C5A059]" /></div>;
  }

  const orgs = data?.organizations || [];
  const stats = data?.stats || { mrr: 0, arr: 0, active: 0, canceled: 0, pastDue: 0, totalRevenue: 0 };

  const filtered = orgs.filter((o: any) => {
    if (filter === "all") return true;
    if (filter === "active") return o.status === "active";
    if (filter === "trial") return o.status === "trial";
    if (filter === "canceled") return o.status === "canceled";
    if (filter === "past_due") return o.status === "past_due";
    return true;
  });

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<DollarSign className="w-4 h-4" />} label="MRR" value={`${stats.mrr}€`} color="text-[#C5A059]" bg="bg-[#C5A059]/10 border-[#C5A059]/20" />
        <KPI icon={<TrendingUp className="w-4 h-4" />} label="ARR" value={`${stats.arr}€`} color="text-green-400" bg="bg-green-500/10 border-green-500/20" />
        <KPI icon={<Building2 className="w-4 h-4" />} label="Activos" value={stats.active} color="text-blue-400" bg="bg-blue-500/10 border-blue-500/20" />
        <KPI icon={<AlertCircle className="w-4 h-4" />} label="Pago pendiente" value={stats.pastDue} color="text-red-400" bg="bg-red-500/10 border-red-500/20" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["all", "active", "trial", "past_due", "canceled"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 text-xs font-medium rounded-full border", filter === f ? "bg-[#C5A059] text-[#0a0a0a] border-[#C5A059]" : "bg-white/5 text-neutral-400 border-white/10")}>
            {f === "all" ? "Todos" : f === "active" ? "Activos" : f === "trial" ? "Prueba" : f === "past_due" ? "Pago pendiente" : "Cancelados"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#16161a] rounded-xl border border-[#27272a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1f1f23] border-b border-[#27272a]">
              <tr className="text-left text-xs text-neutral-500 uppercase">
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Ciclo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Próximo cobro</th>
                <th className="px-4 py-3">MRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-neutral-500">No hay datos</td></tr>
              ) : filtered.map((org: any) => (
                <tr key={org.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-[#f5f5f0]">{org.name}</td>
                  <td className="px-4 py-3 text-neutral-400">{org.plan_label || "—"}</td>
                  <td className="px-4 py-3 text-neutral-400">{org.billing_cycle || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase",
                      org.status === "active" ? "bg-green-500/15 text-green-400" :
                      org.status === "trial" ? "bg-blue-500/15 text-blue-400" :
                      org.status === "past_due" ? "bg-red-500/15 text-red-400" :
                      "bg-neutral-500/15 text-neutral-400"
                    )}>{org.status}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-400 text-xs">{org.current_period_end ? new Date(org.current_period_end).toLocaleDateString("es-ES") : "—"}</td>
                  <td className="px-4 py-3 text-[#C5A059] font-semibold">{org.mrr ? `${org.mrr}€` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: any; color: string; bg: string }) {
  return (
    <div className={cn("rounded-xl border p-4", bg)}>
      <div className={cn("flex items-center gap-1.5 mb-1", color)}>{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <p className="text-2xl font-bold text-[#f5f5f0]">{value}</p>
    </div>
  );
}
