"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, Search, Crown, Cake, Phone, Mail, Star, TrendingUp, AlertTriangle, Calendar, Wine, Heart, Users, Activity, Gift, MessageCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIER_COLORS, TIER_ICONS } from "@/lib/loyalty";

export function CrmSection() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterSegment, setFilterSegment] = useState("");

  const { data: customersData, isLoading } = useQuery({
    queryKey: ["crm-customers", search, filterSegment],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterSegment) params.set("segment", filterSegment);
      params.set("limit", "50");
      return api(`/api/crm/customers?${params}`);
    },
  });

  const { data: segmentsData } = useQuery({
    queryKey: ["crm-segments"],
    queryFn: () => api("/api/crm/segments"),
  });

  if (selectedId) {
    return <CustomerDetail customerId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const customers = (customersData as any)?.customers || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">CRM</h2>
        <p className="text-sm text-neutral-400 mt-0.5">Gestión completa de clientes con IA predictiva</p>
      </div>

      {/* Segmentos automáticos */}
      {segmentsData?.segments?.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterSegment("")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition",
              !filterSegment ? "bg-[#C5A059] text-[#0a0a0a] border-[#C5A059]" : "bg-white/5 text-neutral-400 border-white/10"
            )}
          >
            Todos
          </button>
          {segmentsData.segments.map((s: any) => (
            <button
              key={s.segment}
              onClick={() => setFilterSegment(s.segment)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition",
                filterSegment === s.segment ? "bg-[#C5A059] text-[#0a0a0a] border-[#C5A059]" : "bg-white/5 text-neutral-400 border-white/10"
              )}
            >
              {s.segment} ({s.count})
            </button>
          ))}
        </div>
      )}

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono..."
          className="w-full bg-[#111518] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-[#C5A059]"
        />
      </div>

      {/* Lista de clientes */}
      {isLoading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#C5A059]" />
        </div>
      ) : customers.length === 0 ? (
        <div className="py-20 text-center text-neutral-500">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No se encontraron clientes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="w-full bg-[#111518] rounded-xl border border-white/[0.06] p-4 hover:border-[#C5A059]/30 transition flex items-center gap-4 text-left"
            >
              {/* Avatar */}
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: TIER_COLORS[c.loyalty_tier as keyof typeof TIER_COLORS] + "20", color: TIER_COLORS[c.loyalty_tier as keyof typeof TIER_COLORS] }}
              >
                {TIER_ICONS[c.loyalty_tier as keyof typeof TIER_ICONS]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                  {c.vip_status && <Crown className="w-3.5 h-3.5 text-[#C5A059] flex-shrink-0" />}
                  {c.segment && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 uppercase">{c.segment}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{c.visits_count || 0} visitas</span>
                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{Number(c.lifetime_value || 0).toFixed(0)}€ LTV</span>
                  {(c.no_shows_count > 0) && (
                    <span className="flex items-center gap-1 text-red-400"><AlertTriangle className="w-3 h-3" />{c.no_shows_count} no-shows</span>
                  )}
                </div>
              </div>

              {/* Puntos */}
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-[#C5A059]">{c.loyalty_points || 0}</p>
                <p className="text-[10px] text-neutral-500 uppercase">puntos</p>
              </div>

              <ChevronRight className="w-4 h-4 text-neutral-600 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerDetail({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const qc = useQueryClient();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["crm-customer", customerId],
    queryFn: () => api(`/api/crm/customers/${customerId}`),
  });

  const { data: predictions } = useQuery({
    queryKey: ["crm-predictions", customerId],
    queryFn: () => api(`/api/crm/customers/${customerId}/predictions`),
  });

  const { data: similar } = useQuery({
    queryKey: ["crm-similar", customerId],
    queryFn: () => api(`/api/crm/customers/${customerId}/similar`),
  });

  const recalcMut = useMutation({
    mutationFn: () => api(`/api/crm/customers/${customerId}/recalc`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-customer", customerId] });
    },
  });

  if (isLoading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#C5A059]" />
      </div>
    );
  }

  const c = customer as any;
  if (!c) return null;
  const p = (predictions as any) || {};

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-neutral-400 hover:text-white flex items-center gap-1">
        ← Volver
      </button>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: TIER_COLORS[c.loyalty_tier as keyof typeof TIER_COLORS] + "20" }}
        >
          {TIER_ICONS[c.loyalty_tier as keyof typeof TIER_ICONS]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">{c.name}</h2>
            {c.vip_status && <Crown className="w-5 h-5 text-[#C5A059]" />}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-neutral-400">
            {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
            {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
          </div>
        </div>
        <button
          onClick={() => recalcMut.mutate()}
          disabled={recalcMut.isPending}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-neutral-300 hover:bg-white/10"
        >
          {recalcMut.isPending ? "Recalculando..." : "Recalcular IA"}
        </button>
      </div>

      {/* Métricas clave */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Visitas" value={c.visits_count || 0} icon={<Calendar className="w-4 h-4" />} color="blue" />
        <Metric label="LTV" value={`${Number(c.lifetime_value || 0).toFixed(0)}€`} icon={<TrendingUp className="w-4 h-4" />} color="green" />
        <Metric label="Ticket medio" value={`${Number(c.avg_ticket || 0).toFixed(0)}€`} icon={<Star className="w-4 h-4" />} color="purple" />
        <Metric label="Puntos" value={c.loyalty_points || 0} icon={<Gift className="w-4 h-4" />} color="gold" />
      </div>

      {/* Alertas */}
      {(c.no_shows_count > 0 || c.cancellations_count > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <div>
              <p className="text-xs text-red-400">No-shows</p>
              <p className="text-lg font-bold text-red-400">{c.no_shows_count}</p>
            </div>
          </div>
          <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <div>
              <p className="text-xs text-orange-400">Cancelaciones</p>
              <p className="text-lg font-bold text-orange-400">{c.cancellations_count}</p>
            </div>
          </div>
        </div>
      )}

      {/* Predicciones IA */}
      <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#C5A059]" />
          <h3 className="text-sm font-semibold text-white">Predicciones IA</h3>
          {p.cluster && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[#C5A059]/20 text-[#C5A059]">{p.cluster}</span>
          )}
        </div>
        <div className="space-y-3">
          <ProbBar label="Probabilidad de volver" value={p.prob_return} color="green" />
          <ProbBar label="Probabilidad de cancelar" value={p.prob_cancel} color="red" />
          <ProbBar label="Probabilidad de no-show" value={p.prob_no_show} color="orange" />
          <ProbBar label="Probabilidad de upsell" value={p.prob_upsell} color="blue" />
          <ProbBar label="Probabilidad de VIP" value={p.prob_vip} color="purple" />
          <ProbBar label="Probabilidad de churn" value={p.prob_churn} color="red" />
        </div>
        {p.risk_score !== undefined && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Score de riesgo</span>
              <span className={cn(
                "font-bold",
                p.risk_score > 60 ? "text-red-400" : p.risk_score > 30 ? "text-orange-400" : "text-green-400"
              )}>
                {p.risk_score}/100
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Preferencias */}
      <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Preferencias</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {c.birthday && (
            <div className="flex items-center gap-2 text-neutral-300">
              <Cake className="w-3.5 h-3.5 text-pink-400" />
              <span>Cumpleaños: {new Date(c.birthday).toLocaleDateString("es-ES")}</span>
            </div>
          )}
          {c.preferred_zone && (
            <div className="flex items-center gap-2 text-neutral-300">
              <Star className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Zona: {c.preferred_zone}</span>
            </div>
          )}
          {c.favorite_drink && (
            <div className="flex items-center gap-2 text-neutral-300">
              <Wine className="w-3.5 h-3.5 text-purple-400" />
              <span>Bebida: {c.favorite_drink}</span>
            </div>
          )}
          {c.allergies?.length > 0 && (
            <div className="flex items-center gap-2 text-neutral-300">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>Alergias: {c.allergies.join(", ")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Clientes similares */}
      {similar?.similar?.length > 0 && (
        <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-[#C5A059]" />
            <h3 className="text-sm font-semibold text-white">Clientes similares</h3>
          </div>
          <div className="space-y-1.5">
            {similar.similar.slice(0, 3).map((s: any) => (
              <div key={s.id} className="flex items-center gap-2 text-xs text-neutral-300 py-1">
                <Heart className="w-3 h-3 text-neutral-500" />
                <span>{s.name}</span>
                <span className="ml-auto text-neutral-500">{Number(s.lifetime_value || 0).toFixed(0)}€</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, icon, color }: { label: string; value: any; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    green: "text-green-400 bg-green-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    gold: "text-[#C5A059] bg-[#C5A059]/10",
  };
  return (
    <div className="bg-[#111518] rounded-xl border border-white/[0.06] p-3">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", colors[color])}>{icon}</div>
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function ProbBar({ label, value, color }: { label: string; value: number; color: string }) {
  const v = Math.round((Number(value || 0)) * 100);
  const colors: Record<string, string> = {
    green: "bg-green-500", red: "bg-red-500", orange: "bg-orange-500",
    blue: "bg-blue-500", purple: "bg-purple-500",
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-neutral-400">{label}</span>
        <span className="text-xs font-semibold text-white">{v}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", colors[color])} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
