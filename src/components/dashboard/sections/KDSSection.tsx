"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, Clock, AlertCircle, CheckCircle2, ChefHat, Bell, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  PENDING: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", label: "Pendiente", icon: Clock },
  ACCEPTED: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", label: "Aceptado", icon: CheckCircle2 },
  PREPARING: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", label: "Preparando", icon: Flame },
  READY: { color: "text-green-400", bg: "bg-green-500/10 border-green-500/30", label: "Listo", icon: Bell },
  SERVED: { color: "text-neutral-400", bg: "bg-neutral-500/10 border-neutral-500/20", label: "Servido", icon: CheckCircle2 },
  CANCELLED: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", label: "Cancelado", icon: AlertCircle },
};

export function KDSSection() {
  const qc = useQueryClient();
  const [selectedStation, setSelectedStation] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["kds", selectedStation],
    queryFn: () => api(`/api/kds${selectedStation ? `?stationId=${selectedStation}` : ""}`),
     // refresh cada 5s para tiempo real
  });

  const statusMut = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: string }) =>
      api(`/api/kds/${itemId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kds"] }),
  });

  const items = (data as any)?.items || [];
  const stats = (data as any)?.stats || {};
  const stations = (data as any)?.stations || [];

  // Agrupar por mesa
  const byTable: Record<string, any[]> = {};
  for (const item of items) {
    const tableNum = item.orders?.tables?.number || "Sin mesa";
    if (!byTable[tableNum]) byTable[tableNum] = [];
    byTable[tableNum].push(item);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Cocina (KDS)</h2>
          <p className="text-sm text-neutral-400 mt-0.5">Sistema de gestión de cocina en tiempo real</p>
        </div>
        {/* Stats */}
        <div className="flex gap-2">
          <StatChip label="Pendientes" value={stats.pending || 0} color="yellow" />
          <StatChip label="Preparando" value={stats.preparing || 0} color="orange" />
          <StatChip label="Listos" value={stats.ready || 0} color="green" />
          {stats.avg_prep_time_min > 0 && (
            <StatChip label="T. medio" value={`${stats.avg_prep_time_min}min`} color="blue" />
          )}
        </div>
      </div>

      {/* Filtro estaciones */}
      {stations.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedStation("")}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition",
              !selectedStation ? "bg-[#C5A059] text-[#0a0a0a] border-[#C5A059]" : "bg-white/5 text-neutral-400 border-white/10")}
          >
            Todas
          </button>
          {stations.map((s: any) => (
            <button
              key={s.id}
              onClick={() => setSelectedStation(s.id)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition flex items-center gap-1.5",
                selectedStation === s.id ? "text-[#0a0a0a] border-transparent" : "bg-white/5 text-neutral-400 border-white/10")}
              style={selectedStation === s.id ? { backgroundColor: s.color } : undefined}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Items */}
      {isLoading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#C5A059]" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-neutral-500">
          <ChefHat className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay pedidos activos en cocina</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(byTable).map(([tableNum, tableItems]) => (
            <div key={tableNum} className="bg-[#111518] rounded-xl border border-white/[0.06] p-4">
              {/* Mesa header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">Mesa {tableNum}</h3>
                <span className="text-[10px] text-neutral-500">
                  {tableItems.length} {tableItems.length === 1 ? "plato" : "platos"}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {tableItems.map((item: any) => {
                  const config = STATUS_CONFIG[item.kds_status] || STATUS_CONFIG.PENDING;
                  const Icon = config.icon;
                  const elapsed = item.kds_accepted_at
                    ? Math.round((Date.now() - new Date(item.kds_accepted_at).getTime()) / 60000)
                    : Math.round((Date.now() - new Date(item.created_at).getTime()) / 60000);
                  const isLate = elapsed > 15 && item.kds_status !== "READY";

                  return (
                    <div key={item.id} className={cn("rounded-lg border p-3", config.bg)}>
                      <div className="flex items-start gap-2 mb-2">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", config.bg)}>
                          <Icon className={cn("w-4 h-4", config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{item.quantity}x</span>
                            <span className="text-sm text-white truncate">{item.menu_items?.name || "Plato"}</span>
                          </div>
                          {item.notes && (
                            <p className="text-[10px] text-neutral-400 mt-0.5 italic">"{item.notes}"</p>
                          )}
                          {item.kds_notes && (
                            <p className="text-[10px] text-orange-300 mt-0.5">👨‍🍳 {item.kds_notes}</p>
                          )}
                        </div>
                        {/* Timer */}
                        <div className={cn("text-xs font-mono", isLate ? "text-red-400" : "text-neutral-500")}>
                          {elapsed}min
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex gap-1">
                        {item.kds_status === "PENDING" && (
                          <button
                            onClick={() => statusMut.mutate({ itemId: item.id, status: "PREPARING" })}
                            className="flex-1 h-7 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                          >
                            Empezar
                          </button>
                        )}
                        {item.kds_status === "ACCEPTED" && (
                          <button
                            onClick={() => statusMut.mutate({ itemId: item.id, status: "PREPARING" })}
                            className="flex-1 h-7 rounded text-[10px] font-semibold bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                          >
                            Preparando
                          </button>
                        )}
                        {item.kds_status === "PREPARING" && (
                          <button
                            onClick={() => statusMut.mutate({ itemId: item.id, status: "READY" })}
                            className="flex-1 h-7 rounded text-[10px] font-semibold bg-green-500/20 text-green-400 hover:bg-green-500/30"
                          >
                            Listo ✓
                          </button>
                        )}
                        {item.kds_status === "READY" && (
                          <button
                            onClick={() => statusMut.mutate({ itemId: item.id, status: "SERVED" })}
                            className="flex-1 h-7 rounded text-[10px] font-semibold bg-neutral-500/20 text-neutral-300 hover:bg-neutral-500/30"
                          >
                            Servido ✓
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: any; color: string }) {
  const colors: Record<string, string> = {
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  return (
    <div className={cn("px-3 py-1.5 rounded-lg border text-center min-w-[60px]", colors[color])}>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-[9px] uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}
