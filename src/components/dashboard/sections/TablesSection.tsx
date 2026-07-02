"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { SectionHeader, EmptyState } from "@/components/shared/SectionHeader";
import { TableStatusBadge, ZONE_LABEL } from "@/components/shared/StatusBadge";
import {
  Plus, Grid3x3, Loader2, Trash2, Users, Pencil, List, MapPin,
  Clock, X, Check, Crown, Sparkles, Link2, Unlink, Move, Save,
  Search, Calendar, Star, TrendingUp, Phone,
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

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// DESIGN SYSTEM — Neon LED table styles (milimétrico a la referencia)
// ═══════════════════════════════════════════════════════════════
const NEON_STYLES: Record<string, {
  border: string; bg: string; text: string; glow: string; breathing: string; label: string;
}> = {
  AVAILABLE: {
    border: "border-green-500",
    bg: "bg-[#2A2D35]",
    text: "text-green-400",
    glow: "shadow-[0_0_20px_rgba(34,197,94,0.5),inset_0_0_15px_rgba(34,197,94,0.3)]",
    breathing: "shadow-[0_0_15px_rgba(34,197,94,0.4),inset_0_0_10px_rgba(34,197,94,0.2)]",
    label: "Libre",
  },
  OCCUPIED: {
    border: "border-red-500",
    bg: "bg-[#2A2D35]",
    text: "text-red-400",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.5),inset_0_0_15px_rgba(239,68,68,0.3)]",
    breathing: "shadow-[0_0_15px_rgba(239,68,68,0.4),inset_0_0_10px_rgba(239,68,68,0.2)]",
    label: "Ocupada",
  },
  RESERVED: {
    border: "border-yellow-400",
    bg: "bg-[#2A2D35]",
    text: "text-yellow-400",
    glow: "shadow-[0_0_20px_rgba(250,204,21,0.5),inset_0_0_15px_rgba(250,204,21,0.3)]",
    breathing: "shadow-[0_0_15px_rgba(250,204,21,0.4),inset_0_0_10px_rgba(250,204,21,0.2)]",
    label: "Reservada",
  },
  PREPARING: {
    border: "border-blue-500",
    bg: "bg-[#2A2D35]",
    text: "text-blue-400",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.5),inset_0_0_15px_rgba(59,130,246,0.3)]",
    breathing: "shadow-[0_0_15px_rgba(59,130,246,0.4),inset_0_0_10px_rgba(59,130,246,0.2)]",
    label: "Preparando",
  },
};

const ZONES = [
  { id: "INTERIOR", label: "Interior", color: "#6366f1", icon: "🏠" },
  { id: "TERRACE", label: "Terraza", color: "#22c55e", icon: "🌿" },
  { id: "BAR", label: "Barra", color: "#f59e0b", icon: "🍸" },
  { id: "VIP", label: "VIP", color: "#C5A059", icon: "👑" },
];

const SHAPE_STYLES: Record<string, string> = { ROUND: "rounded-full", SQUARE: "rounded-xl", RECTANGLE: "rounded-lg" };

// ═══════════════════════════════════════════════════════════════
// MAIN SECTION
// ═══════════════════════════════════════════════════════════════
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tables"] }); toast.success("Posiciones guardadas ✓"); setPendingPositions({}); },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tables"] }); qc.invalidateQueries({ queryKey: ["analytics"] }); setSelectedTable(null); toast.success("Estado actualizado ✓"); },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/tables/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Mesa eliminada"); qc.invalidateQueries({ queryKey: ["tables"] }); setConfirmDelete(null); },
  });

  // ─── DRAG & DROP ───
  const handleDragStart = useCallback((e: React.MouseEvent, table: Table) => {
    if (!editMode) return;
    e.preventDefault();
    setDraggingId(table.id);
    const tableEl = e.currentTarget as HTMLElement;
    const tableRect = tableEl.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - tableRect.left, y: e.clientY - tableRect.top };
  }, [editMode]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!draggingId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.current.x;
    const y = e.clientY - rect.top - dragOffset.current.y;
    const clampedX = Math.max(0, Math.min(x, rect.width - 70));
    const clampedY = Math.max(0, Math.min(y, rect.height - 70));
    setPendingPositions(prev => ({ ...prev, [draggingId]: { x: clampedX, y: clampedY } }));
  }, [draggingId]);

  const handleDragEnd = useCallback(() => { setDraggingId(null); }, []);

  const savePositions = () => {
    const updates = Object.entries(pendingPositions).map(([id, pos]) => ({ id, posX: Math.round(pos.x * 3), posY: Math.round(pos.y * 3) }));
    if (updates.length > 0) savePositionsMut.mutate(updates);
  };

  const toggleGroupSelection = (tableId: string) => {
    setSelectedForGroup(prev => { const next = new Set(prev); if (next.has(tableId)) next.delete(tableId); else next.add(tableId); return next; });
  };

  const getTablePos = (table: Table) => {
    const pending = pendingPositions[table.id];
    if (pending) return { left: pending.x, top: pending.y };
    return { left: table.posX / 3, top: table.posY / 3 };
  };

  return (
    <div className="flex flex-col h-full" onMouseMove={handleDragMove} onMouseUp={handleDragEnd}>
      {/* HEADER */}
      <motion.div initial={reduceMotion ? {} : { opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">Plano de sala</h2>
            <p className="text-sm text-gray-400 mt-0.5">{summary.total} mesas · {summary.capacity} cubiertos · {summary.occupied} ocupadas</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {editMode ? (
              <>
                <Button size="sm" variant="outline" className="bg-white/5 border-white/10 text-gray-400" onClick={() => { setEditMode(false); setPendingPositions({}); setSelectedForGroup(new Set()); }}>
                  <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={savePositions} disabled={savePositionsMut.isPending || Object.keys(pendingPositions).length === 0}>
                  {savePositionsMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1" /> Guardar</>}
                </Button>
                {selectedForGroup.size >= 2 && (
                  <Button size="sm" className="bg-yellow-400 hover:bg-yellow-500 text-black" onClick={() => groupMut.mutate(Array.from(selectedForGroup))} disabled={groupMut.isPending}>
                    {groupMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Link2 className="w-3.5 h-3.5 mr-1" /> Agrupar ({selectedForGroup.size})</>}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" className="bg-white/5 border-white/10 text-gray-400" onClick={() => setEditMode(true)}>
                  <Move className="w-3.5 h-3.5 mr-1" /> Editar plano
                </Button>
                <div className="flex lg:hidden items-center bg-white/5 border border-white/10 rounded-lg p-1">
                  <button onClick={() => setMobileView("floor")} className={cn("px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5", mobileView === "floor" ? "bg-yellow-400 text-black" : "text-gray-400")}><MapPin className="w-3.5 h-3.5" /> Plano</button>
                  <button onClick={() => setMobileView("grid")} className={cn("px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5", mobileView === "grid" ? "bg-yellow-400 text-black" : "text-gray-400")}><List className="w-3.5 h-3.5" /> Lista</button>
                </div>
                <Button className="bg-yellow-400 hover:bg-yellow-500 text-black" onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1.5" /> Nueva</Button>
              </>
            )}
          </div>
        </div>
        {/* KPIs */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 sm:gap-2">
          {[
            { label: "Total", value: summary.total, cls: "bg-white/5 border-white/10 text-white" },
            { label: "Libres", value: summary.available, cls: "bg-green-500/10 border-green-500/20 text-green-400" },
            { label: "Reservadas", value: summary.reserved, cls: "bg-yellow-400/10 border-yellow-400/20 text-yellow-400" },
            { label: "Ocupadas", value: summary.occupied, cls: "bg-red-500/10 border-red-500/20 text-red-400" },
            { label: "Preparando", value: summary.preparing, cls: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
            { label: "Cubiertos", value: `${summary.occupiedSeats}/${summary.capacity}`, cls: "bg-yellow-400/10 border-yellow-400/20 text-yellow-400" },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={reduceMotion ? {} : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className={cn("rounded-lg sm:rounded-xl p-2 sm:p-2.5 border flex items-center gap-1.5 sm:gap-2.5", kpi.cls)}>
              <div><p className="text-sm sm:text-lg font-bold leading-none">{kpi.value}</p><p className="text-[8px] sm:text-[9px] opacity-60 mt-0.5">{kpi.label}</p></div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Zone filters + legend */}
      <div className="flex flex-wrap items-center gap-2 mb-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <button onClick={() => setSelectedZone("ALL")} className={cn("px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap border", selectedZone === "ALL" ? "bg-yellow-400 text-black border-yellow-400" : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10")}>Todas ({tables.length})</button>
        {ZONES.map(z => { const count = tables.filter(t => t.zone === z.id).length; if (count === 0) return null;
          return <button key={z.id} onClick={() => setSelectedZone(z.id)} className={cn("px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap border flex items-center gap-1.5", selectedZone === z.id ? "bg-yellow-400 text-black border-yellow-400" : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10")}><span>{z.icon}</span> {z.label} ({count})</button>;
        })}
        <div className="flex-1" />
        {editMode && <span className="text-xs text-yellow-400 flex items-center gap-1"><Move className="w-3 h-3" /> Arrastra las mesas</span>}
      </div>

      {/* MAIN */}
      {isLoading ? (
        <div className="py-20 flex items-center justify-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : filteredTables.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10"><EmptyState icon={<Grid3x3 className="w-6 h-6" />} title="No hay mesas" description="Crea tu primera mesa." action={<Button className="bg-yellow-400 hover:bg-yellow-500 text-black" onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1.5" /> Añadir mesa</Button>} /></div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_280px] gap-4 flex-1 min-h-0">
          {/* FLOOR PLAN */}
          <div className={cn(mobileView === "grid" && "hidden lg:block")}>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-3 sm:p-4 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-yellow-400" /><h3 className="font-semibold text-white text-sm">Sala en vivo</h3></div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-400">{summary.available} libres</span><span className="text-gray-600">·</span>
                  <span className="text-red-400">{summary.occupied} ocupadas</span>
                </div>
              </div>

              {/* Scrollable canvas container — overflow auto on mobile, fixed on desktop */}
              <div className="overflow-x-auto overflow-y-auto rounded-xl" style={{ scrollbarWidth: "thin" }}>
                {/* Canvas with min dimensions to prevent table overlap on mobile */}
                <div ref={containerRef} className="relative bg-[#13151A] rounded-xl border border-white/[0.04] p-3 min-w-[800px] min-h-[500px]" style={{ touchAction: editMode ? "none" : "auto" }}>
                  {/* Gradientes radiales para profundidad */}
                  <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
                    <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-green-500/5 blur-[100px]" />
                    <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-yellow-400/5 blur-[100px]" />
                    <div className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full bg-blue-500/3 blur-[80px]" />
                  </div>
                  {/* Decoración */}
                  <div className="absolute top-2 right-4 text-2xl opacity-15 pointer-events-none select-none">🪴</div>
                  <div className="absolute bottom-2 left-4 text-2xl opacity-15 pointer-events-none select-none">🌿</div>

                  {/* Mesas por zona — positioned with absolute coords on the 800x500+ canvas */}
                  <div className="relative w-full h-full">
                    {Array.from(new Set(filteredTables.map(t => t.zone))).map(zone => {
                      const zoneTables = filteredTables.filter(t => t.zone === zone);
                      const zoneMeta = ZONES.find(z => z.id === zone);
                      const zoneLabelY = zoneTables.length > 0 ? Math.min(...zoneTables.map(t => t.posY / 3)) - 20 : 0;
                      return (
                        <div key={zone}>
                          {/* Zone label positioned absolutely */}
                          <div className="absolute z-5" style={{ left: 12, top: Math.max(0, zoneLabelY) }}>
                            <span className="text-[10px] font-semibold text-gray-500 uppercase flex items-center gap-1 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: zoneMeta?.color }} />
                              {zoneMeta?.icon} {ZONE_LABEL[zone] || zone} · {zoneTables.length}
                            </span>
                          </div>
                          {zoneTables.map(t => (
                            <InteractiveTable
                              key={t.id}
                              table={t}
                              reservation={tableReservationMap.get(t.id) || null}
                              editMode={editMode}
                              isDragging={draggingId === t.id}
                              isSelected={selectedTable?.id === t.id}
                              isHovered={hoveredTableId === t.id}
                              isGroupSelected={selectedForGroup.has(t.id)}
                              pos={getTablePos(t)}
                              reduceMotion={!!reduceMotion}
                              onDragStart={handleDragStart}
                              onHover={(id) => setHoveredTableId(id)}
                              onSelect={(t) => editMode ? toggleGroupSelection(t.id) : setSelectedTable(t)}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer stats */}
              <div className="mt-3 pt-3 border-t border-white/[0.04] grid grid-cols-4 gap-2 text-center">
                <div><p className="text-lg font-bold text-green-400">{summary.available}</p><p className="text-[9px] text-gray-600">Libres</p></div>
                <div><p className="text-lg font-bold text-yellow-400">{summary.reserved}</p><p className="text-[9px] text-gray-600">Reservadas</p></div>
                <div><p className="text-lg font-bold text-red-400">{summary.occupied}</p><p className="text-[9px] text-gray-600">Ocupadas</p></div>
                <div><p className="text-lg font-bold text-blue-400">{summary.preparing}</p><p className="text-[9px] text-gray-600">Preparando</p></div>
              </div>
            </div>
          </div>

          {/* SIDEBAR — ReservationSidebar con efecto borde amarillo luminoso */}
          <div className={cn("space-y-2 overflow-y-auto max-h-[calc(100vh-340px)] pr-1", mobileView === "floor" && "hidden lg:block")} style={{ scrollbarWidth: "thin" }}>
            <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-yellow-400" /> Reservas activas</p>
              <div className="space-y-1.5 max-h-[calc(100vh-420px)] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                {reservations.filter(r => ["CONFIRMED", "SEATED", "PENDING"].includes(r.status)).slice(0, 15).map((r, i) => {
                  const isActive = hoveredTableId && r.table?.id === hoveredTableId;
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      whileHover={{ x: -2 }}
                      onHoverStart={() => { if (r.table?.id) setHoveredTableId(r.table.id); }}
                      onHoverEnd={() => setHoveredTableId(null)}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all",
                        isActive
                          ? "bg-yellow-400/10 border border-yellow-400/80 shadow-[0_0_15px_rgba(250,204,21,0.4)]"
                          : "bg-black/30 border border-white/[0.04] hover:border-white/[0.08]"
                      )}
                    >
                      <div className="flex flex-col items-center justify-center min-w-10 pr-2 border-r border-white/[0.06]">
                        <p className="text-sm font-bold text-white">{formatTime(r.date)}</p>
                        <div className="flex items-center gap-0.5 text-[10px] text-gray-400"><Users className="w-2.5 h-2.5" />{r.partySize}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{r.customerName}</p>
                        {r.table ? <p className="text-[10px] text-yellow-400">Mesa {r.table.number} · {ZONE_LABEL[r.table.zone]}</p> : <p className="text-[10px] text-gray-600">Sin mesa</p>}
                      </div>
                      <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded uppercase", r.status === "CONFIRMED" ? "bg-green-500/15 text-green-400" : r.status === "SEATED" ? "bg-blue-500/15 text-blue-400" : "bg-yellow-400/15 text-yellow-400")}>{r.status}</span>
                    </motion.div>
                  );
                })}
                {reservations.filter(r => ["CONFIRMED", "SEATED", "PENDING"].includes(r.status)).length === 0 && <p className="text-xs text-gray-600 py-4 text-center">Sin reservas activas</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABLE DETAIL DIALOG */}
      <TableDetailDialog table={selectedTable} reservation={selectedTable ? tableReservationMap.get(selectedTable.id) || null : null} onClose={() => setSelectedTable(null)} onEdit={(t) => { setSelectedTable(null); setEditing(t); }} onStatusChange={(id, status) => updateStatusMut.mutate({ id, status })} onUngroup={(groupId) => { ungroupMut.mutate(groupId); setSelectedTable(null); }} />

      {/* CREATE/EDIT DIALOG */}
      <TableDialog key={editing?.id || "new"} open={creating || !!editing} table={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { qc.invalidateQueries({ queryKey: ["tables"] }); qc.invalidateQueries({ queryKey: ["analytics"] }); }} />

      {/* DELETE */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent className="bg-[#1A1D24] border-white/10 text-white"><AlertDialogHeader><AlertDialogTitle>¿Eliminar mesa?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="bg-white/5 border-white/10 text-gray-300">Cancelar</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => confirmDelete && delMut.mutate(confirmDelete)} disabled={delMut.isPending}>{delMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Eliminar"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// InteractiveTable — Mesa arrastrable con neón LED + popover CRM
// ═══════════════════════════════════════════════════════════════
function InteractiveTable({
  table, reservation, editMode, isDragging, isSelected, isHovered, isGroupSelected, pos, reduceMotion,
  onDragStart, onHover, onSelect,
}: {
  table: Table; reservation: Reservation | null; editMode: boolean; isDragging: boolean;
  isSelected: boolean; isHovered: boolean; isGroupSelected: boolean;
  pos: { left: number; top: number }; reduceMotion: boolean;
  onDragStart: (e: React.MouseEvent, t: Table) => void;
  onHover: (id: string | null) => void;
  onSelect: (t: Table) => void;
}) {
  const [showPopover, setShowPopover] = useState(false);
  const style = NEON_STYLES[table.status] || NEON_STYLES.AVAILABLE;
  const shapeCls = SHAPE_STYLES[table.shape] || SHAPE_STYLES.SQUARE;
  const sizeCls = table.shape === "RECTANGLE" ? "w-16 h-10" : "w-14 h-14";

  return (
    <motion.div
      initial={reduceMotion ? {} : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      style={{ position: "absolute", left: `${(pos.left / 400) * 100}%`, top: `${(pos.top / 300) * 100}%`, cursor: editMode ? (isDragging ? "grabbing" : "grab") : "pointer", zIndex: isDragging ? 20 : 1 }}
      onMouseDown={(e) => onDragStart(e, table)}
      onMouseEnter={() => { if (!editMode) { onHover(table.id); setShowPopover(true); } }}
      onMouseLeave={() => { if (!editMode) { onHover(null); setShowPopover(false); } }}
      onClick={() => onSelect(table)}
      whileHover={editMode ? {} : { scale: 1.12, zIndex: 10 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "border-2 flex flex-col items-center justify-center transition-all select-none drop-shadow-2xl",
        shapeCls, sizeCls, style.bg, style.border, style.text,
        (isHovered || isSelected) && "ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#13151A]",
        style.glow,
        isGroupSelected && "ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#13151A]",
        table.group_id && "border-dashed",
        isDragging && "opacity-80 scale-105",
      )}
    >
      {/* Breathing neon effect — pulsación del box-shadow */}
      {(table.status === "OCCUPIED" || table.status === "RESERVED" || table.status === "PREPARING") && !reduceMotion && (
        <motion.span
          animate={{ boxShadow: [
            "0 0 8px rgba(34,197,94,0.3)",
            "0 0 16px rgba(34,197,94,0.5)",
            "0 0 8px rgba(34,197,94,0.3)",
          ] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className={cn("absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full",
            table.status === "OCCUPIED" ? "bg-red-500" : table.status === "RESERVED" ? "bg-yellow-400" : "bg-blue-500"
          )}
        />
      )}

      {/* Contenido de la mesa */}
      <span className="text-xs font-bold leading-none text-white">{table.number}</span>
      {reservation ? (
        <>
          <span className="text-[7px] mt-0.5 truncate max-w-full px-0.5 leading-tight text-white">{reservation.customerName.split(" ")[0]}</span>
          <span className="text-[7px] opacity-70 text-gray-300">{formatTime(reservation.date)}</span>
        </>
      ) : (
        <span className="text-[8px] mt-0.5 opacity-50 text-gray-400">{table.capacity}p</span>
      )}

      {/* VIP crown */}
      {table.zone === "VIP" && <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 text-yellow-400" />}

      {/* Group indicator */}
      {table.group_id && <Link2 className="absolute -bottom-1 -right-1 w-3 h-3 text-yellow-400 bg-[#13151A] rounded-full p-0.5" />}

      {/* Selection check */}
      {isGroupSelected && <Check className="absolute -top-1 -left-1 w-3 h-3 text-green-400 bg-[#13151A] rounded-full p-0.5" />}

      {/* ─── POPOVER CRM (Glassmorphism extremo) ─── */}
      <AnimatePresence>
        {showPopover && !editMode && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 pointer-events-none"
            style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: "8px" }}
          >
            <div className="w-52 bg-[#1A1D24]/80 backdrop-blur-xl border border-yellow-400/50 rounded-xl shadow-[0_0_30px_rgba(250,204,21,0.15)] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white">Mesa {table.number}</span>
                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase", style.bg, style.text, "border", style.border)}>{style.label}</span>
              </div>
              {reservation ? (
                <div className="space-y-2">
                  {/* Avatar + nombre */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-black flex items-center justify-center text-[10px] font-bold border border-yellow-400/50">
                      {reservation.customerName.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{reservation.customerName}</p>
                      <p className="text-[10px] text-gray-400">{reservation.phone}</p>
                    </div>
                  </div>
                  {/* Stats en cajas negras */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-black/40 rounded-xl p-1.5">
                      <div className="flex items-center gap-1 text-[10px] text-gray-400"><Clock className="w-2.5 h-2.5 text-yellow-400" />{formatTime(reservation.date)}</div>
                    </div>
                    <div className="bg-black/40 rounded-xl p-1.5">
                      <div className="flex items-center gap-1 text-[10px] text-gray-400"><Users className="w-2.5 h-2.5 text-yellow-400" />{reservation.partySize} pax</div>
                    </div>
                  </div>
                  {/* Estado */}
                  <div className="flex items-center gap-1 pt-1 border-t border-white/[0.04]">
                    <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded uppercase",
                      reservation.status === "CONFIRMED" ? "bg-green-500/15 text-green-400" :
                      reservation.status === "SEATED" ? "bg-blue-500/15 text-blue-400" :
                      "bg-yellow-400/15 text-yellow-400"
                    )}>{reservation.status.replace(/_/g, " ")}</span>
                    <span className="text-[9px] text-gray-500">{ZONE_LABEL[reservation.zone || ""] || reservation.zone}</span>
                  </div>
                  {reservation.notes && <p className="text-[9px] text-gray-400 italic truncate">"{reservation.notes}"</p>}
                </div>
              ) : (
                <div className="text-center py-1">
                  <Sparkles className="w-4 h-4 text-green-400 mx-auto mb-0.5" />
                  <p className="text-[10px] text-gray-400">Mesa disponible</p>
                  <p className="text-[9px] text-gray-600">Capacidad: {table.capacity}p</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TABLE DETAIL DIALOG
// ═══════════════════════════════════════════════════════════════
function TableDetailDialog({ table, reservation, onClose, onEdit, onStatusChange, onUngroup }: {
  table: Table | null; reservation: Reservation | null; onClose: () => void;
  onEdit: (t: Table) => void; onStatusChange: (id: string, status: string) => void; onUngroup: (groupId: string) => void;
}) {
  if (!table) return null;
  const style = NEON_STYLES[table.status] || NEON_STYLES.AVAILABLE;
  return (
    <Dialog open={!!table} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#1A1D24]/95 backdrop-blur-xl border-white/10 text-white">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><div className={cn("w-9 h-9 rounded-lg border-2 flex items-center justify-center text-sm font-bold", style.bg, style.border, style.text)}>{table.number}</div>{table.name || `Mesa ${table.number}`}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-gray-400">Capacidad</p><p className="font-medium text-white flex items-center gap-1"><Users className="w-3.5 h-3.5" />{table.capacity}</p></div>
            <div><p className="text-xs text-gray-400">Zona</p><p className="font-medium text-white">{ZONE_LABEL[table.zone] || table.zone}</p></div>
            <div><p className="text-xs text-gray-400">Forma</p><p className="font-medium text-white">{table.shape === "ROUND" ? "Redonda" : table.shape === "RECTANGLE" ? "Rectangular" : "Cuadrada"}</p></div>
            <div><p className="text-xs text-gray-400">Estado</p><TableStatusBadge status={table.status} /></div>
            {table.group_id && <div className="col-span-2"><p className="text-xs text-gray-400">Grupo</p><div className="flex items-center gap-2"><span className="text-sm text-yellow-400 flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Agrupada</span><button onClick={() => onUngroup(table.group_id!)} className="text-xs text-red-400 hover:underline flex items-center gap-1"><Unlink className="w-3 h-3" /> Desagrupar</button></div></div>}
          </div>
          <div><p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Cambiar estado</p><div className="grid grid-cols-2 gap-2">{Object.entries(NEON_STYLES).map(([key, val]) => (<button key={key} onClick={() => onStatusChange(table.id, key)} disabled={key === table.status} className={cn("px-3 py-2 rounded-lg text-xs font-medium border transition-colors", key === table.status ? "bg-white/[0.03] text-gray-500 border-white/[0.04] cursor-not-allowed" : "bg-black/30 text-gray-300 border-white/[0.06] hover:bg-white/[0.04]")}><span className={cn("inline-block w-2 h-2 rounded-full mr-1.5 border", val.border)} />{val.label}</button>))}</div></div>
          {reservation ? (<div className="p-3 rounded-lg bg-black/30 border border-white/[0.06]"><p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5 flex items-center gap-1"><Calendar className="w-3 h-3 text-yellow-400" />Reserva asociada</p><div className="flex items-center justify-between text-sm"><div><p className="font-medium text-white">{reservation.customerName}</p><p className="text-xs text-gray-400">{formatTime(reservation.date)} · {reservation.partySize} pax</p></div><span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded uppercase", reservation.status === "CONFIRMED" ? "bg-green-500/15 text-green-400" : reservation.status === "SEATED" ? "bg-blue-500/15 text-blue-400" : "bg-yellow-400/15 text-yellow-400")}>{reservation.status}</span></div></div>) : <p className="text-xs text-gray-600 text-center py-3">Sin reservas próximas</p>}
          <div className="flex gap-2 pt-2 border-t border-white/[0.06]"><Button variant="outline" className="flex-1 h-9 text-xs bg-black/30 border-white/[0.06] text-gray-300" onClick={() => onEdit(table)}><Pencil className="w-3.5 h-3.5 mr-1" /> Editar</Button><Button variant="outline" onClick={onClose} className="h-9 text-xs bg-black/30 border-white/[0.06] text-gray-300">Cerrar</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// TABLE DIALOG (create/edit)
// ═══════════════════════════════════════════════════════════════
function TableDialog({ open, table, onClose, onSaved }: { open: boolean; table: Table | null; onClose: () => void; onSaved: () => void; }) {
  const [number, setNumber] = useState(table?.number || "");
  const [name, setName] = useState(table?.name || "");
  const [capacity, setCapacity] = useState(table?.capacity || 4);
  const [zone, setZone] = useState(table?.zone || "INTERIOR");
  const [shape, setShape] = useState(table?.shape || "SQUARE");
  const [status, setStatus] = useState(table?.status || "AVAILABLE");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!number.trim()) { toast.error("Número obligatorio"); return; }
    setSaving(true);
    try {
      const payload = { number: number.trim(), name: name.trim() || null, capacity: Number(capacity), zone, shape, status };
      if (table) { await api(`/api/tables/${table.id}`, { method: "PATCH", body: JSON.stringify(payload) }); toast.success("Mesa actualizada ✓"); }
      else { await api("/api/tables", { method: "POST", body: JSON.stringify(payload) }); toast.success("Mesa creada ✓"); }
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#1A1D24] border-white/10 text-white">
        <DialogHeader><DialogTitle>{table ? `Editar mesa ${table.number}` : "Nueva mesa"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs text-gray-400">Número *</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="1" className="bg-black/30 border-white/10 text-white" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-gray-400">Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mesa ventana" className="bg-black/30 border-white/10 text-white" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label className="text-xs text-gray-400">Capacidad</Label><Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="bg-black/30 border-white/10 text-white" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-gray-400">Zona</Label><Select value={zone} onValueChange={setZone}><SelectTrigger className="bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger><SelectContent>{ZONES.map(z => <SelectItem key={z.id} value={z.id}>{z.icon} {z.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs text-gray-400">Forma</Label><Select value={shape} onValueChange={setShape}><SelectTrigger className="bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SQUARE">Cuadrada</SelectItem><SelectItem value="ROUND">Redonda</SelectItem><SelectItem value="RECTANGLE">Rectangular</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs text-gray-400">Estado</Label><Select value={status} onValueChange={setStatus}><SelectTrigger className="bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(NEON_STYLES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="bg-black/30 border-white/10 text-gray-300">Cancelar</Button>
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-black" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : table ? "Guardar" : "Crear mesa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
