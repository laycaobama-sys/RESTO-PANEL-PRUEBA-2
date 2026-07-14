"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, Clock, Users, Crown, CheckCircle2, XCircle, Bell, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";

export function WaitlistSection() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["waitlist"],
    queryFn: () => api("/api/waitlist"),
    
  });

  const seatMut = useMutation({
    mutationFn: ({ id, tableId }: { id: string; tableId: string }) =>
      api(`/api/waitlist/${id}`, { method: "PATCH", body: JSON.stringify({ action: "seat", tableId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waitlist"] });
      toast.success("Cliente sentado");
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) =>
      api(`/api/waitlist/${id}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waitlist"] });
      toast.success("Entrada cancelada");
    },
  });

  const entries = (data as any)?.entries || [];
  const stats = (data as any)?.stats || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Lista de espera inteligente</h2>
          <p className="text-sm text-neutral-400 mt-0.5">IA prioriza VIPs y estima tiempos</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]">
          <Plus className="w-4 h-4 mr-1.5" /> Añadir
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="En espera" value={stats.total_waiting || 0} icon={<Clock className="w-4 h-4" />} color="orange" />
        <StatCard label="Espera media" value={`${stats.avg_wait_min || 0} min`} icon={<Clock className="w-4 h-4" />} color="blue" />
        <StatCard label="VIPs en espera" value={stats.vip_waiting || 0} icon={<Crown className="w-4 h-4" />} color="gold" />
        <StatCard label="Sentados hoy" value={stats.total_seated_today || 0} icon={<CheckCircle2 className="w-4 h-4" />} color="green" />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#C5A059]" />
        </div>
      ) : entries.length === 0 ? (
        <div className="py-20 text-center text-neutral-500">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Lista de espera vacía</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e: any, i: number) => (
            <div key={e.id} className="bg-[#111518] rounded-xl border border-white/[0.06] p-4 flex items-center gap-4">
              {/* Posición */}
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-neutral-400">
                {i + 1}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{e.customer_name}</p>
                  {e.vip_status && <Crown className="w-3.5 h-3.5 text-[#C5A059]" />}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-neutral-500">
                  <span>{e.party_size} pax</span>
                  {e.preferred_zone && <span>· {e.preferred_zone}</span>}
                  <span>· espera ~{e.estimated_wait_min || 15} min</span>
                </div>
              </div>

              {/* Score */}
              <div className="text-right">
                <p className="text-sm font-bold text-[#C5A059]">{e.priority_score}</p>
                <p className="text-[10px] text-neutral-500 uppercase">prioridad</p>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const tableId = prompt("ID de la mesa:");
                    if (tableId) seatMut.mutate({ id: e.id, tableId });
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-green-400 hover:bg-green-500/10"
                  title="Sentar"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => cancelMut.mutate(e.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10"
                  title="Cancelar"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddToWaitlistDialog onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddToWaitlistDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [zone, setZone] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      api("/api/waitlist", {
        method: "POST",
        body: JSON.stringify({
          customer_name: name,
          phone,
          party_size: Number(partySize),
          preferred_zone: zone || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Añadido a la lista de espera");
      qc.invalidateQueries({ queryKey: ["waitlist"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#1A1D24] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Añadir a lista de espera</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          <input type="number" value={partySize} onChange={(e) => setPartySize(e.target.value)} placeholder="Personas" className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          <select value={zone} onChange={(e) => setZone(e.target.value)} className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">Sin zona preferida</option>
            <option value="INTERIOR">Interior</option>
            <option value="TERRACE">Terraza</option>
            <option value="BAR">Barra</option>
            <option value="VIP">VIP</option>
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-white/10 text-neutral-300">Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!name || mut.isPending} className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]">
            {mut.isPending ? "Añadiendo..." : "Añadir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: any; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    orange: "text-orange-400 bg-orange-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    gold: "text-[#C5A059] bg-[#C5A059]/10",
    green: "text-green-400 bg-green-500/10",
  };
  return (
    <div className="bg-[#111518] rounded-xl border border-white/[0.06] p-3">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", colors[color])}>{icon}</div>
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}
