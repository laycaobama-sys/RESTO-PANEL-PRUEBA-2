"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { SectionHeader, EmptyState } from "@/components/shared/SectionHeader";
import { TableStatusBadge, ZONE_LABEL, ZONE_COLOR } from "@/components/shared/StatusBadge";
import {
  Plus, Grid3x3, Loader2, Trash2, Users, Pencil, List, MapPin,
  Clock, X, Check, Crown, Sparkles, Link2, Unlink, Lock, Unlock,
  Search, Star, Calendar, Move, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface Table {
  id: string; number: string; name?: string | null; capacity: number;
  zone: string; shape: string; posX: number; posY: number; status: string;
  group_id?: string | null; blocked?: boolean;
  reservations?: any[];
}
interface Reservation {
  id: string; customerName: string; phone: string; email?: string | null;
  partySize: number; date: string; status: string; shift: string;
  zone?: string | null; notes?: string | null;
  table?: { id: string; number: string; name?: string | null; zone: string } | null;
}

const ZONES = [
  { id: "INTERIOR", label: "Interior", color: "#6366f1", icon: "🏠" },
  { id: "TERRACE", label: "Terraza", color: "#22c55e", icon: "🌿" },
  { id: "BAR", label: "Barra", color: "#f59e0b", icon: "🍸" },
  { id: "VIP", label: "VIP", color: "#C5A059", icon: "👑" },
];

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; glow: string; label: string; neon: string }> = {
  AVAILABLE: { bg: "bg-green-500/8", border: "border-green-500/30", text: "text-green-400", glow: "shadow-[0_0_20px_rgba(34,197,94,0.15)]", label: "Libre", neon: "shadow-[0_0_12px_rgba(34,197,94,0.3),inset_0_0_8px_rgba(34,197,94,0.1)]" },
  OCCUPIED: { bg: "bg-red-500/8", border: "border-red-500/30", text: "text-red-400", glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]", label: "Ocupada", neon: "shadow-[0_0_12px_rgba(239,68,68,0.3),inset_0_0_8px_rgba(239,68,68,0.1)]" },
  RESERVED: { bg: "bg-yellow-500/8", border: "border-yellow-500/30", text: "text-yellow-400", glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]", label: "Reservada", neon: "shadow-[0_0_12px_rgba(245,158,11,0.3),inset_0_0_8px_rgba(245,158,11,0.1)]" },
  PREPARING: { bg: "bg-blue-500/8", border: "border-blue-500/30", text: "text-blue-400", glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]", label: "Preparando", neon: "shadow-[0_0_12px_rgba(59,130,246,0.3),inset_0_0_8px_rgba(59,130,246,0.1)]" },
};

const SHAPE_STYLES: Record<string, string> = { ROUND: "rounded-full", SQUARE: "rounded-xl", RECTANGLE: "rounded-lg" };

export function TablesSection() {
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [editing, setEditing] = useState<Table | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedZone, setSelectedZone] = useState("ALL");
  const [mobileView, setMobileView] = useState<"floor" | "grid">("floor");
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<Set<string>>(new Set());
  const [pendingPositions, setPendingPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: tables = [], isLoading } = useQuery<Table[]>({ queryKey: ["tables"], queryFn: () => api("/api/tables") });
  const { data: reservations = [] } = useQuery<Reservation[]>({
    queryKey: ["reservations-today"],
    queryFn: () => {
      const today = new Date(); const tzOffset = today.getTimezoneOffset() * 60000;
      return api(`/api/reservations?date=${new Date(today.getTime() - tzOffset).toISOString().slice(0, 10)}`);
    },
  });

  const tableReservationMap = (() => {
    const map = new Map<string, Reservation>();
    for (const r of reservations) { if (r.table?.id && ["CONFIRMED", "SEATED", "PENDING"].includes(r.status)) map.set(r.table.id, r); }
    return map;
  })();

  const filteredTables = tables.filter(t => selectedZone === "ALL" || t.zone === selectedZone);
  const summary = {
    total: tables.length, available: tables.filter(t => t.status === "AVAILABLE").length,
    occupied: tables.filter(t => t.status === "OCCUPIED").length, reserved: tables.filter(t => t.status === "RESERVED").length,
    preparing: tables.filter(t => t.status === "PREPARING").length,
    capacity: tables.reduce((s, t) => s + t.capacity, 0),
    occupiedSeats: tables.filter(t => t.status === "OCCUPIED").reduce((s, t) => s + t.capacity, 0),
  };

  const savePositionsMut = useMutation({
    mutationFn: (updates: Array<{ id: string; posX: number; posY: number }>) =>
      api("/api/tables/positions", { method: "POST", body: JSON.stringify({ updates }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tables"] }); toast.success("Posiciones guardadas"); setPendingPositions({}); },
    onError: (e: any) => toast.error(e.message),
  });

  const groupMut = useMutation({
    mutationFn: (tableIds: string[]) => api("/api/tables/group", { method: "POST", body: JSON.stringify({ tableIds }) }),
    onSuccess: (data: any) => { qc.invalidateQueries({ queryKey: ["tables"] }); toast.success(data.message); setSelectedForGroup(new Set()); },
    onError: (e: any) => toast.error(e.message),
  });

  const ungroupMut = useMutation({
    mutationFn: (groupId: string) => api(`/api/tables/group?groupId=${groupId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tables"] }); toast.success("Mesas desagrupadas"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/api/tables/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tables"] }); qc.invalidateQueries({ queryKey: ["analytics"] }); setSelectedTable(null); toast.success("Estado actualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/tables/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Mesa eliminada"); qc.invalidateQueries({ queryKey: ["tables"] }); setConfirmDelete(null); },
  });

  // ─── DRAG & DROP LOGIC ───
  const handleDragStart = useCallback((e: React.MouseEvent, table: Table) => {
    if (!editMode) return;
    e.preventDefault();
    setDraggingId(table.id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const tableEl = e.currentTarget as HTMLElement;
      const tableRect = tableEl.getBoundingClientRect();
      dragOffset.current = { x: e.clientX - tableRect.left, y: e.clientY - tableRect.top };
    }
  }, [editMode]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!draggingId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.current.x;
    const y = e.clientY - rect.top - dragOffset.current.y;
    // Constrain to container bounds
    const clampedX = Math.max(0, Math.min(x, rect.width - 60));
    const clampedY = Math.max(0, Math.min(y, rect.height - 60));
    setPendingPositions(prev => ({ ...prev, [draggingId]: { x: clampedX, y: clampedY } }));
  }, [draggingId]);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
  }, []);

  const savePositions = () => {
    const updates = Object.entries(pendingPositions).map(([id, pos]) => ({ id, posX: Math.round(pos.x * 3), posY: Math.round(pos.y * 3) }));
    if (updates.length > 0) savePositionsMut.mutate(updates);
  };

  const toggleGroupSelection = (tableId: string) => {
    setSelectedForGroup(prev => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId); else next.add(tableId);
      return next;
    });
  };

  const getTablePos = (table: Table) => {
    const pending = pendingPositions[table.id];
    if (pending) return { left: pending.x, top: pending.y };
    return { left: (table.posX / 3), top: (table.posY / 3) };
  };

  return (
    <div className="flex flex-col h-full" onMouseMove={handleDragMove} onMouseUp={handleDragEnd}>
      {/* HEADER */}
      <motion.div initial={reduceMotion ? {} : { opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#f5f5f0]">Plano de sala</h2>
            <p className="text-sm text-neutral-500 mt-0.5">{summary.total} mesas · {summary.capacity} cubiertos · {summary.occupied} ocupadas</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {editMode ? (
              <>
                <Button size="sm" variant="outline" className="bg-[#1a1f24] border-white/[0.06] text-neutral-300" onClick={() => { setEditMode(false); setPendingPositions({}); setSelectedForGroup(new Set()); }}>
                  <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={savePositions} disabled={savePositionsMut.isPending || Object.keys(pendingPositions).length === 0}>
                  {savePositionsMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1" /> Guardar posiciones</>}
                </Button>
                {selectedForGroup.size >= 2 && (
                  <Button size="sm" className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]" onClick={() => groupMut.mutate(Array.from(selectedForGroup))} disabled={groupMut.isPending}>
                    {groupMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Link2 className="w-3.5 h-3.5 mr-1" /> Agrupar ({selectedForGroup.size})</>}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" className="bg-[#1a1f24] border-white/[0.06] text-neutral-300" onClick={() => setEditMode(true)}>
                  <Move className="w-3.5 h-3.5 mr-1" /> Editar plano
                </Button>
                <div className="flex lg:hidden items-center bg-[#1a1f24] border border-white/[0.06] rounded-lg p-1">
                  <button onClick={() => setMobileView("floor")} className={cn("px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5", mobileView === "floor" ? "bg-[#C5A059] text-[#0a0a0a]" : "text-neutral-400")}><MapPin className="w-3.5 h-3.5" /> Plano</button>
                  <button onClick={() => setMobileView("grid")} className={cn("px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5", mobileView === "grid" ? "bg-[#C5A059] text-[#0a0a0a]" : "text-neutral-400")}><List className="w-3.5 h-3.5" /> Lista</button>
                </div>
                <Button className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]" onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1.5" /> Nueva</Button>
              </>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 sm:gap-2">
          {[
            { label: "Total", value: summary.total, cls: "bg-[#111518] border-white/[0.06] text-[#f5f5f0]" },
            { label: "Libres", value: summary.available, cls: "bg-green-500/10 border-green-500/20 text-green-400" },
            { label: "Reservadas", value: summary.reserved, cls: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" },
            { label: "Ocupadas", value: summary.occupied, cls: "bg-red-500/10 border-red-500/20 text-red-400" },
            { label: "Preparando", value: summary.preparing, cls: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
            { label: "Cubiertos", value: `${summary.occupiedSeats}/${summary.capacity}`, cls: "bg-[#C5A059]/10 border-[#C5A059]/20 text-[#C5A059]" },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={reduceMotion ? {} : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className={cn("rounded-lg sm:rounded-xl p-2 sm:p-2.5 border flex items-center gap-1.5 sm:gap-2.5", kpi.cls)}>
              <div><p className="text-sm sm:text-lg font-bold leading-none">{kpi.value}</p><p className="text-[8px] sm:text-[9px] opacity-60 mt-0.5">{kpi.label}</p></div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Zone filters + legend */}
      <div className="flex flex-wrap items-center gap-2 mb-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <button onClick={() => setSelectedZone("ALL")} className={cn("px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap border", selectedZone === "ALL" ? "bg-[#C5A059] text-[#0a0a0a] border-[#C5A059]" : "bg-[#111518] text-neutral-400 border-white/[0.06] hover:bg-white/[0.03]")}>Todas ({tables.length})</button>
        {ZONES.map(z => { const count = tables.filter(t => t.zone === z.id).length; if (count === 0) return null;
          return <button key={z.id} onClick={() => setSelectedZone(z.id)} className={cn("px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap border flex items-center gap-1.5", selectedZone === z.id ? "bg-[#C5A059] text-[#0a0a0a] border-[#C5A059]" : "bg-[#111518] text-neutral-400 border-white/[0.06] hover:bg-white/[0.03]")}><span>{z.icon}</span> {z.label} ({count})</button>;
        })}
        <div className="flex-1" />
        {editMode && <span className="text-xs text-[#C5A059] flex items-center gap-1"><Move className="w-3 h-3" /> Arrastra las mesas para moverlas</span>}
      </div>

      {/* MAIN CONTENT */}
      {isLoading ? (
        <div className="py-20 flex items-center justify-center text-neutral-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : filteredTables.length === 0 ? (
        <div className="bg-[#111518]/80 backdrop-blur-xl rounded-2xl border border-white/[0.06]"><EmptyState icon={<Grid3x3 className="w-6 h-6" />} title="No hay mesas" description="Crea tu primera mesa para empezar." action={<Button className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]" onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1.5" /> Añadir mesa</Button>} /></div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_280px] gap-4 flex-1 min-h-0">
          {/* Floor plan */}
          <div className={cn(mobileView === "grid" && "hidden lg:block")}>
            <div className="bg-[#111518]/60 backdrop-blur-xl rounded-2xl border border-white/[0.06] p-3 sm:p-4 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#C5A059]" /><h3 className="font-semibold text-[#f5f5f0] text-sm">Sala en vivo</h3></div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-400">{tables.filter(t => t.status === "AVAILABLE").length} libres</span>
                  <span className="text-neutral-600">·</span>
                  <span className="text-red-400">{tables.filter(t => t.status === "OCCUPIED").length} ocupadas</span>
                </div>
              </div>

              {/* Draggable canvas */}
              <div ref={containerRef} className="relative bg-gradient-to-br from-[#0a0a0a] to-[#0d1014] rounded-xl border border-white/[0.04] p-3 min-h-[340px] overflow-hidden" style={{ touchAction: editMode ? "none" : "auto" }}>
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/4 left-1/4 w-48 h-48 rounded-full bg-[#C5A059]/5 blur-[80px]" />
                  <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-[#004D40]/5 blur-[80px]" />
                </div>
                <div className="absolute top-2 right-4 text-2xl opacity-20 pointer-events-none select-none">🪴</div>
                <div className="absolute bottom-2 left-4 text-2xl opacity-20 pointer-events-none select-none">🌿</div>

                {/* Render tables by zone sections */}
                <div className="relative space-y-3">
                  {Array.from(new Set(filteredTables.map(t => t.zone))).map(zone => {
                    const zoneTables = filteredTables.filter(t => t.zone === zone);
                    const zoneMeta = ZONES.find(z => z.id === zone);
                    return (
                      <div key={zone}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-semibold text-neutral-600 uppercase flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: zoneMeta?.color || "#666" }} />
                            {zoneMeta?.icon} {ZONE_LABEL[zone] || zone} · {zoneTables.length} mesas
                          </span>
                          <div className="flex-1 h-px bg-white/[0.04]" />
                        </div>
                        <div className="relative w-full" style={{ height: `${Math.max(80, Math.max(...zoneTables.map(t => t.posY)) / 3 + 50)}px` }}>
                          {zoneTables.map(t => {
                            const style = STATUS_CONFIG[t.status] || STATUS_CONFIG.AVAILABLE;
                            const res = tableReservationMap.get(t.id);
                            const isHovered = hoveredTableId === t.id;
                            const isSelected = selectedTable?.id === t.id;
                            const isDragging = draggingId === t.id;
                            const isGroupSelected = selectedForGroup.has(t.id);
                            const shapeCls = SHAPE_STYLES[t.shape] || SHAPE_STYLES.SQUARE;
                            const sizeCls = t.shape === "RECTANGLE" ? "w-16 h-10" : "w-14 h-14";
                            const pos = getTablePos(t);
                            return (
                              <motion.div
                                key={t.id}
                                initial={reduceMotion ? {} : { opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.2 }}
                                style={{ position: "absolute", left: `${(pos.left / 400) * 100}%`, top: `${(pos.top / 300) * 100}%`, cursor: editMode ? (isDragging ? "grabbing" : "grab") : "pointer", zIndex: isDragging ? 20 : 1 }}
                                onMouseDown={(e) => handleDragStart(e, t)}
                                onMouseEnter={() => !editMode && setHoveredTableId(t.id)}
                                onMouseLeave={() => !editMode && setHoveredTableId(null)}
                                onClick={() => { if (editMode) { toggleGroupSelection(t.id); } else { setSelectedTable(t); } }}
                                whileHover={editMode ? {} : { scale: 1.12, zIndex: 10 }}
                                whileTap={{ scale: 0.95 }}
                                className={cn(
                                  "border-2 flex flex-col items-center justify-center transition-all select-none",
                                  shapeCls, sizeCls, style.bg, style.border, style.text,
                                  (isHovered || isSelected) && "ring-2 ring-[#C5A059] ring-offset-2 ring-offset-[#0a0a0a]",
                                  (isHovered || isSelected) && style.glow,
                                  style.neon,
                                  isGroupSelected && "ring-2 ring-[#C5A059] ring-offset-2 ring-offset-[#0a0a0a]",
                                  t.group_id && "border-dashed",
                                  isDragging && "opacity-80 scale-105",
                                )}
                              >
                                {(t.status === "OCCUPIED" || t.status === "RESERVED" || t.status === "PREPARING") && (
                                  <motion.span animate={reduceMotion ? {} : { scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2.5, repeat: Infinity }} className={cn("absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full", t.status === "OCCUPIED" ? "bg-red-500" : t.status === "RESERVED" ? "bg-yellow-500" : "bg-blue-500")} />
                                )}
                                <span className="text-xs font-bold leading-none">{t.number}</span>
                                {res ? (<><span className="text-[7px] mt-0.5 truncate max-w-full px-0.5 leading-tight">{res.customerName.split(" ")[0]}</span><span className="text-[7px] opacity-70">{formatTime(res.date)}</span></>) : (<span className="text-[8px] mt-0.5 opacity-50">{t.capacity}p</span>)}
                                {t.zone === "VIP" && <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 text-[#C5A059]" />}
                                {t.group_id && <Link2 className="absolute -bottom-1 -right-1 w-3 h-3 text-[#C5A059] bg-[#0a0a0a] rounded-full p-0.5" />}
                                {isGroupSelected && <Check className="absolute -top-1 -left-1 w-3 h-3 text-green-400 bg-[#0a0a0a] rounded-full p-0.5" />}
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer stats */}
              <div className="mt-3 pt-3 border-t border-white/[0.04] grid grid-cols-4 gap-2 text-center">
                <div><p className="text-lg font-bold text-green-400">{tables.filter(t => t.status === "AVAILABLE").length}</p><p className="text-[9px] text-neutral-600">Libres</p></div>
                <div><p className="text-lg font-bold text-yellow-400">{tables.filter(t => t.status === "RESERVED").length}</p><p className="text-[9px] text-neutral-600">Reservadas</p></div>
                <div><p className="text-lg font-bold text-red-400">{tables.filter(t => t.status === "OCCUPIED").length}</p><p className="text-[9px] text-neutral-600">Ocupadas</p></div>
                <div><p className="text-lg font-bold text-blue-400">{tables.filter(t => t.status === "PREPARING").length}</p><p className="text-[9px] text-neutral-600">Preparando</p></div>
              </div>
            </div>
          </div>

          {/* Sidebar: Active reservations */}
          <div className={cn("space-y-2 overflow-y-auto max-h-[calc(100vh-340px)] pr-1", mobileView === "floor" && "hidden lg:block")} style={{ scrollbarWidth: "thin" }}>
            <div className="bg-[#111518]/80 backdrop-blur-xl rounded-xl border border-white/[0.06] p-3">
              <p className="text-xs font-semibold text-neutral-400 uppercase mb-2 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-[#C5A059]" /> Reservas activas ({reservations.filter(r => ["CONFIRMED", "SEATED", "PENDING"].includes(r.status)).length})</p>
              <div className="space-y-1.5 max-h-[calc(100vh-420px)] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                {reservations.filter(r => ["CONFIRMED", "SEATED", "PENDING"].includes(r.status)).slice(0, 15).map((r, i) => (
                  <motion.div key={r.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ x: -2 }} onHoverStart={() => { if (r.table?.id) setHoveredTableId(r.table.id); }} onHoverEnd={() => setHoveredTableId(null)} className={cn("flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all", hoveredTableId && r.table?.id === hoveredTableId ? "bg-[#C5A059]/10 border border-[#C5A059]/20" : "bg-[#0a0a0a]/40 border border-white/[0.04] hover:border-white/[0.08]")}>
                    <div className="flex flex-col items-center justify-center min-w-10 pr-2 border-r border-white/[0.06]"><p className="text-sm font-bold text-[#f5f5f0]">{formatTime(r.date)}</p><div className="flex items-center gap-0.5 text-[10px] text-neutral-500"><Users className="w-2.5 h-2.5" />{r.partySize}</div></div>
                    <div className="flex-1 min-w-0"><p className="text-xs font-medium text-[#f5f5f0] truncate">{r.customerName}</p>{r.table ? <p className="text-[10px] text-[#C5A059]">Mesa {r.table.number} · {ZONE_LABEL[r.table.zone] || r.table.zone}</p> : <p className="text-[10px] text-neutral-600">Sin mesa asignada</p>}</div>
                    <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded uppercase whitespace-nowrap", r.status === "CONFIRMED" ? "bg-green-500/15 text-green-400" : r.status === "SEATED" ? "bg-blue-500/15 text-blue-400" : "bg-yellow-500/15 text-yellow-400")}>{r.status}</span>
                  </motion.div>
                ))}
                {reservations.filter(r => ["CONFIRMED", "SEATED", "PENDING"].includes(r.status)).length === 0 && <p className="text-xs text-neutral-600 py-4 text-center">Sin reservas activas</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABLE DETAIL DIALOG */}
      <TableDetailDialog table={selectedTable} reservation={selectedTable ? tableReservationMap.get(selectedTable.id) || null : null} onClose={() => setSelectedTable(null)} onEdit={(t) => { setSelectedTable(null); setEditing(t); }} onStatusChange={(id, status) => updateStatusMut.mutate({ id, status })} onUngroup={(groupId) => { ungroupMut.mutate(groupId); setSelectedTable(null); }} />

      {/* CREATE/EDIT DIALOG */}
      <TableDialog key={editing?.id || "new"} open={creating || !!editing} table={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { qc.invalidateQueries({ queryKey: ["tables"] }); qc.invalidateQueries({ queryKey: ["analytics"] }); }} />

      {/* DELETE CONFIRMATION */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent className="bg-[#111518] border-white/[0.06] text-[#f5f5f0]">
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar mesa?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="bg-[#1a1f24] border-white/[0.06] text-neutral-300">Cancelar</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => confirmDelete && delMut.mutate(confirmDelete)} disabled={delMut.isPending}>{delMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Eliminar"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── TABLE DETAIL DIALOG ───
function TableDetailDialog({ table, reservation, onClose, onEdit, onStatusChange, onUngroup }: {
  table: Table | null; reservation: Reservation | null; onClose: () => void;
  onEdit: (t: Table) => void; onStatusChange: (id: string, status: string) => void; onUngroup: (groupId: string) => void;
}) {
  if (!table) return null;
  const style = STATUS_CONFIG[table.status] || STATUS_CONFIG.AVAILABLE;
  return (
    <Dialog open={!!table} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#111518]/95 backdrop-blur-xl border-white/[0.08] text-[#f5f5f0]">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><div className={cn("w-9 h-9 rounded-lg border-2 flex items-center justify-center text-sm font-bold", style.bg, style.border, style.text)}>{table.number}</div>{table.name || `Mesa ${table.number}`}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-neutral-500">Capacidad</p><p className="font-medium text-[#f5f5f0] flex items-center gap-1"><Users className="w-3.5 h-3.5" />{table.capacity} personas</p></div>
            <div><p className="text-xs text-neutral-500">Zona</p><p className="font-medium text-[#f5f5f0]">{ZONE_LABEL[table.zone] || table.zone}</p></div>
            <div><p className="text-xs text-neutral-500">Forma</p><p className="font-medium text-[#f5f5f0]">{table.shape === "ROUND" ? "Redonda" : table.shape === "RECTANGLE" ? "Rectangular" : "Cuadrada"}</p></div>
            <div><p className="text-xs text-neutral-500">Estado</p><TableStatusBadge status={table.status} /></div>
            {table.group_id && <div className="col-span-2"><p className="text-xs text-neutral-500">Grupo</p><div className="flex items-center gap-2"><span className="text-sm text-[#C5A059] flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Agrupada</span><button onClick={() => onUngroup(table.group_id!)} className="text-xs text-red-400 hover:underline flex items-center gap-1"><Unlink className="w-3 h-3" /> Desagrupar</button></div></div>}
          </div>
          <div><p className="text-[10px] font-semibold text-neutral-500 uppercase mb-2">Cambiar estado</p><div className="grid grid-cols-2 gap-2">{Object.entries(STATUS_CONFIG).map(([key, val]) => (<button key={key} onClick={() => onStatusChange(table.id, key)} disabled={key === table.status} className={cn("px-3 py-2 rounded-lg text-xs font-medium border transition-colors", key === table.status ? "bg-white/[0.03] text-neutral-500 border-white/[0.04] cursor-not-allowed" : "bg-[#1a1f24] text-neutral-300 border-white/[0.06] hover:bg-white/[0.04]")}><span className={cn("inline-block w-2 h-2 rounded-full mr-1.5", val.bg, val.border, "border")} />{val.label}</button>))}</div></div>
          {reservation ? (<div className="p-3 rounded-lg bg-[#1a1f24] border border-white/[0.06]"><p className="text-[10px] font-semibold text-neutral-500 uppercase mb-1.5 flex items-center gap-1"><Calendar className="w-3 h-3 text-[#C5A059]" />Reserva asociada</p><div className="flex items-center justify-between text-sm"><div><p className="font-medium text-[#f5f5f0]">{reservation.customerName}</p><p className="text-xs text-neutral-500">{formatTime(reservation.date)} · {reservation.partySize} pax · {reservation.shift === "LUNCH" ? "Comida" : "Cena"}</p></div><span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded uppercase", reservation.status === "CONFIRMED" ? "bg-green-500/15 text-green-400" : reservation.status === "SEATED" ? "bg-blue-500/15 text-blue-400" : "bg-yellow-500/15 text-yellow-400")}>{reservation.status}</span></div></div>) : <p className="text-xs text-neutral-600 text-center py-3">Sin reservas próximas</p>}
          <div className="flex gap-2 pt-2 border-t border-white/[0.06]"><Button variant="outline" className="flex-1 h-9 text-xs bg-[#1a1f24] border-white/[0.06] text-neutral-300" onClick={() => onEdit(table)}><Pencil className="w-3.5 h-3.5 mr-1" /> Editar</Button><Button variant="outline" onClick={onClose} className="h-9 text-xs bg-[#1a1f24] border-white/[0.06] text-neutral-300">Cerrar</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── TABLE DIALOG (create/edit) ───
function TableDialog({ open, table, onClose, onSaved }: { open: boolean; table: Table | null; onClose: () => void; onSaved: () => void; }) {
  const [number, setNumber] = useState(table?.number || "");
  const [name, setName] = useState(table?.name || "");
  const [capacity, setCapacity] = useState(table?.capacity || 4);
  const [zone, setZone] = useState(table?.zone || "INTERIOR");
  const [shape, setShape] = useState(table?.shape || "SQUARE");
  const [status, setStatus] = useState(table?.status || "AVAILABLE");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!number.trim()) { toast.error("Número obligatorio"); return; }
    setSaving(true);
    try {
      const payload = { number: number.trim(), name: name.trim() || null, capacity: Number(capacity), zone, shape, status };
      if (table) { await api(`/api/tables/${table.id}`, { method: "PATCH", body: JSON.stringify(payload) }); toast.success("Mesa actualizada"); }
      else { await api("/api/tables", { method: "POST", body: JSON.stringify(payload) }); toast.success("Mesa creada"); }
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#111518] border-white/[0.06] text-[#f5f5f0]">
        <DialogHeader><DialogTitle>{table ? `Editar mesa ${table.number}` : "Nueva mesa"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Número *</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="1" className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mesa ventana" className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Capacidad</Label><Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Zona</Label><Select value={zone} onValueChange={setZone}><SelectTrigger className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]"><SelectValue /></SelectTrigger><SelectContent>{ZONES.map(z => <SelectItem key={z.id} value={z.id}>{z.icon} {z.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Forma</Label><Select value={shape} onValueChange={setShape}><SelectTrigger className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SQUARE">Cuadrada</SelectItem><SelectItem value="ROUND">Redonda</SelectItem><SelectItem value="RECTANGLE">Rectangular</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Estado</Label><Select value={status} onValueChange={setStatus}><SelectTrigger className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="bg-[#1a1f24] border-white/[0.06] text-neutral-300">Cancelar</Button>
          <Button className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : table ? "Guardar" : "Crear mesa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
