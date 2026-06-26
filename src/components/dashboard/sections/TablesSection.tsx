"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { SectionHeader, EmptyState } from "@/components/shared/SectionHeader";
import {
  TableStatusBadge,
  ZONE_LABEL,
  ZONE_COLOR,
} from "@/components/shared/StatusBadge";
import {
  Plus,
  Grid3x3,
  Loader2,
  Trash2,
  Users,
  MapPin,
  Calendar,
  X,
  LayoutGrid,
  Sofa,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Reservation {
  id: string;
  customerName: string;
  phone: string;
  partySize: number;
  date: string;
  status: string;
  shift: string;
  zone?: string | null;
}
interface Table {
  id: string;
  number: string;
  name?: string | null;
  capacity: number;
  zone: string;
  shape: string;
  posX: number;
  posY: number;
  status: string;
  reservations?: Reservation[];
}

const ZONES = [
  { id: "INTERIOR", label: "Interior", icon: Sofa, color: "indigo" },
  { id: "TERRACE", label: "Terraza", icon: MapPin, color: "green" },
  { id: "BAR", label: "Barra", icon: Grid3x3, color: "amber" },
  { id: "VIP", label: "VIP", icon: Plus, color: "purple" },
];

const STATUS = [
  { id: "AVAILABLE", label: "Disponible" },
  { id: "OCCUPIED", label: "Ocupada" },
  { id: "RESERVED", label: "Reservada" },
  { id: "PREPARING", label: "En preparación" },
];

const SHAPES = [
  { id: "SQUARE", label: "Cuadrada" },
  { id: "ROUND", label: "Redonda" },
  { id: "RECTANGLE", label: "Rectangular" },
];

export function TablesSection() {
  const qc = useQueryClient();
  const { data: tables = [], isLoading } = useQuery<Table[]>({
    queryKey: ["tables"],
    queryFn: () => api("/api/tables"),
  });
  const [editing, setEditing] = useState<Table | null>(null);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"floor" | "grid">("floor");
  const [selectedZone, setSelectedZone] = useState<string>("ALL");
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  const summary = {
    total: tables.length,
    available: tables.filter((t) => t.status === "AVAILABLE").length,
    occupied: tables.filter((t) => t.status === "OCCUPIED").length,
    reserved: tables.filter((t) => t.status === "RESERVED").length,
    preparing: tables.filter((t) => t.status === "PREPARING").length,
    capacity: tables.reduce((s, t) => s + t.capacity, 0),
  };

  const tablesByZone = (zone: string) =>
    tables.filter((t) => t.zone === zone);

  const filteredTables =
    selectedZone === "ALL" ? tables : tables.filter((t) => t.zone === selectedZone);

  return (
    <div>
      <SectionHeader
        title="Mesas"
        subtitle="Plano visual del salón y estado en tiempo real"
        actions={
          <>
            <div className="flex items-center bg-white border border-[#ececed] rounded-lg p-1">
              <button
                onClick={() => setView("floor")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5",
                  view === "floor"
                    ? "bg-[#FF6B35] text-white"
                    : "text-neutral-600"
                )}
              >
                <MapPin className="w-3.5 h-3.5" />
                Plano
              </button>
              <button
                onClick={() => setView("grid")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5",
                  view === "grid"
                    ? "bg-[#FF6B35] text-white"
                    : "text-neutral-600"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cuadrícula
              </button>
            </div>
            <Button
              className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white"
              onClick={() => setCreating(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Añadir mesa
            </Button>
          </>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 sm:gap-3 mb-5">
        <SummaryPill label="Total" value={summary.total} cls="bg-white border" />
        <SummaryPill label="Libres" value={summary.available} cls="bg-green-50 text-green-700 border border-green-100" />
        <SummaryPill label="Ocupadas" value={summary.occupied} cls="bg-red-50 text-red-700 border border-red-100" />
        <SummaryPill label="Reservadas" value={summary.reserved} cls="bg-yellow-50 text-yellow-700 border border-yellow-100" />
        <SummaryPill label="Preparando" value={summary.preparing} cls="bg-blue-50 text-blue-700 border border-blue-100" />
        <SummaryPill label="Capacidad" value={summary.capacity} cls="bg-[#FFF3ED] text-[#9a3b18] border border-[#FFE0CB]" />
      </div>

      {/* Zone filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedZone("ALL")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap border transition-colors",
            selectedZone === "ALL"
              ? "bg-[#FF6B35] text-white border-[#FF6B35]"
              : "bg-white text-neutral-600 border-[#ececed] hover:bg-neutral-50"
          )}
        >
          Todas las zonas
        </button>
        {ZONES.map((z) => (
          <button
            key={z.id}
            onClick={() => setSelectedZone(z.id)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap border transition-colors flex items-center gap-1.5",
              selectedZone === z.id
                ? "bg-[#FF6B35] text-white border-[#FF6B35]"
                : "bg-white text-neutral-600 border-[#ececed] hover:bg-neutral-50"
            )}
          >
            <z.icon className="w-3 h-3" />
            {z.label} ({tablesByZone(z.id).length})
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-20 flex items-center justify-center text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#ececed]">
          <EmptyState
            icon={<Grid3x3 className="w-6 h-6" />}
            title="No hay mesas en esta zona"
            description="Crea una nueva mesa con el botón de arriba."
          />
        </div>
      ) : view === "floor" ? (
        /* ====================================================
           FLOOR PLAN VIEW - visual map by zone
        ==================================================== */
        <div className="space-y-4">
          {(selectedZone === "ALL" ? ZONES.map((z) => z.id) : [selectedZone]).map(
            (zoneId) => {
              const zoneTables = tablesByZone(zoneId);
              if (zoneTables.length === 0) return null;
              const zoneMeta = ZONES.find((z) => z.id === zoneId);
              if (!zoneMeta) return null;
              return (
                <div
                  key={zoneId}
                  className={cn(
                    "rounded-2xl border p-4 sm:p-5",
                    zoneId === "INTERIOR" && "bg-indigo-50/40 border-indigo-100",
                    zoneId === "TERRACE" && "bg-green-50/40 border-green-100",
                    zoneId === "BAR" && "bg-amber-50/40 border-amber-100",
                    zoneId === "VIP" && "bg-purple-50/40 border-purple-100"
                  )}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <zoneMeta.icon className="w-4 h-4 text-neutral-600" />
                    <h3 className="font-semibold text-neutral-900">
                      {ZONE_LABEL[zoneId]}
                    </h3>
                    <span className="text-xs text-neutral-500">
                      {zoneTables.length} mesas · {zoneTables.reduce((s, t) => s + t.capacity, 0)} cubiertos
                    </span>
                  </div>
                  <div className="relative bg-white/60 backdrop-blur rounded-xl border border-white p-4 min-h-[180px]">
                    {/* Use absolute positioning based on posX/posY */}
                    <div className="relative w-full h-[200px]">
                      {zoneTables.map((t) => (
                        <TableShape
                          key={t.id}
                          table={t}
                          onEdit={() => setEditing(t)}
                          onSelect={() => setSelectedTable(t)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      ) : (
        /* ====================================================
           GRID VIEW - simpler card grid
        ==================================================== */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredTables.map((t) => (
            <TableCard key={t.id} table={t} onEdit={() => setEditing(t)} onSelect={() => setSelectedTable(t)} />
          ))}
        </div>
      )}

      {/* Edit/Create dialog */}
      <TableDialog
        key={editing?.id || "new"}
        open={creating || !!editing}
        table={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["tables"] });
          qc.invalidateQueries({ queryKey: ["analytics"] });
        }}
      />

      {/* Table detail dialog (reservations + status change) */}
      <TableDetailDialog
        table={selectedTable}
        onClose={() => setSelectedTable(null)}
        onEdit={() => {
          if (selectedTable) {
            setEditing(selectedTable);
            setSelectedTable(null);
          }
        }}
        onStatusChange={async (status) => {
          if (!selectedTable) return;
          try {
            await api(`/api/tables/${selectedTable.id}`, {
              method: "PATCH",
              body: JSON.stringify({ status }),
            });
            qc.invalidateQueries({ queryKey: ["tables"] });
            setSelectedTable(null);
            toast.success("Estado de mesa actualizado");
          } catch (e: any) {
            toast.error(e.message);
          }
        }}
      />
    </div>
  );
}

function SummaryPill({
  label,
  value,
  cls,
}: {
  label: string;
  value: number;
  cls: string;
}) {
  return (
    <div className={cn("rounded-xl p-2.5 sm:p-3 border text-center", cls)}>
      <p className="text-xl sm:text-2xl font-bold">{value}</p>
      <p className="text-[10px] sm:text-xs opacity-80">{label}</p>
    </div>
  );
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  AVAILABLE: { bg: "bg-green-100", border: "border-green-400", text: "text-green-800" },
  OCCUPIED: { bg: "bg-red-100", border: "border-red-400", text: "text-red-800" },
  RESERVED: { bg: "bg-yellow-100", border: "border-yellow-400", text: "text-yellow-800" },
  PREPARING: { bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-800" },
};

function TableShape({
  table,
  onEdit,
  onSelect,
}: {
  table: Table;
  onEdit: () => void;
  onSelect: () => void;
}) {
  const colors = STATUS_COLORS[table.status] || STATUS_COLORS.AVAILABLE;
  const shapeCls =
    table.shape === "ROUND"
      ? "rounded-full"
      : table.shape === "RECTANGLE"
      ? "rounded-lg"
      : "rounded-xl";
  const sizeCls =
    table.shape === "RECTANGLE"
      ? "w-20 h-12"
      : "w-16 h-16";

  // Normalize positions to a 0-100% grid (the seed used px in a ~800x200 area)
  const leftPct = Math.min(90, (table.posX / 800) * 100);
  const topPct = Math.min(80, (table.posY / 250) * 100);

  return (
    <button
      onClick={onSelect}
      onDoubleClick={onEdit}
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        top: `${topPct}%`,
      }}
      className={cn(
        "border-2 flex flex-col items-center justify-center transition-transform hover:scale-110 hover:shadow-md hover:z-10",
        shapeCls,
        sizeCls,
        colors.bg,
        colors.border,
        colors.text
      )}
      title={`${table.name || `Mesa ${table.number}`} · ${table.capacity} pax · ${table.status}`}
    >
      <span className="text-xs font-bold leading-none">{table.number}</span>
      <span className="text-[9px] mt-0.5 flex items-center gap-0.5">
        <Users className="w-2.5 h-2.5" />
        {table.capacity}
      </span>
      {table.reservations && table.reservations.length > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF6B35] text-white text-[9px] font-bold flex items-center justify-center">
          {table.reservations.length}
        </span>
      )}
    </button>
  );
}

function TableCard({
  table,
  onEdit,
  onSelect,
}: {
  table: Table;
  onEdit: () => void;
  onSelect: () => void;
}) {
  const colors = STATUS_COLORS[table.status] || STATUS_COLORS.AVAILABLE;
  return (
    <button
      onClick={onSelect}
      className="bg-white rounded-2xl border border-[#ececed] p-4 text-left hover:shadow-md hover:border-[#FF6B35]/40 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={cn(
            "w-12 h-12 rounded-xl border-2 flex items-center justify-center font-bold",
            colors.bg,
            colors.border,
            colors.text,
            table.shape === "ROUND" && "rounded-full",
            table.shape === "RECTANGLE" && "rounded-lg"
          )}
        >
          {table.number}
        </div>
        <span
          className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full border",
            ZONE_COLOR[table.zone] || "bg-neutral-100 text-neutral-600"
          )}
        >
          {ZONE_LABEL[table.zone]}
        </span>
      </div>
      <p className="font-semibold text-neutral-900 text-sm">
        {table.name || `Mesa ${table.number}`}
      </p>
      <div className="flex items-center gap-1 text-xs text-neutral-500 mt-0.5">
        <Users className="w-3 h-3" />
        {table.capacity} personas
      </div>
      <div className="mt-3">
        <TableStatusBadge status={table.status} />
      </div>
      {table.reservations && table.reservations.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#f1f1f3] text-xs text-neutral-600">
          <p className="font-medium text-neutral-700">Próximas reservas:</p>
          {table.reservations.slice(0, 2).map((r) => (
            <p key={r.id} className="mt-0.5">
              {formatTime(r.date)} · {r.customerName} ({r.partySize})
            </p>
          ))}
        </div>
      )}
    </button>
  );
}

function TableDetailDialog({
  table,
  onClose,
  onEdit,
  onStatusChange,
}: {
  table: Table | null;
  onClose: () => void;
  onEdit: () => void;
  onStatusChange: (status: string) => void;
}) {
  if (!table) return null;
  const colors = STATUS_COLORS[table.status] || STATUS_COLORS.AVAILABLE;
  return (
    <Dialog open={!!table} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className={cn(
                "w-9 h-9 rounded-lg border-2 flex items-center justify-center font-bold text-sm",
                colors.bg,
                colors.border,
                colors.text,
                table.shape === "ROUND" && "rounded-full"
              )}
            >
              {table.number}
            </div>
            {table.name || `Mesa ${table.number}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-neutral-400">Capacidad</p>
              <p className="font-medium text-neutral-900 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {table.capacity} personas
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Zona</p>
              <p className="font-medium text-neutral-900">{ZONE_LABEL[table.zone]}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Forma</p>
              <p className="font-medium text-neutral-900">
                {SHAPES.find((s) => s.id === table.shape)?.label || table.shape}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Estado actual</p>
              <TableStatusBadge status={table.status} />
            </div>
          </div>

          {/* Quick status change */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
              Cambiar estado
            </p>
            <div className="grid grid-cols-2 gap-2">
              {STATUS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onStatusChange(s.id)}
                  disabled={s.id === table.status}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
                    s.id === table.status
                      ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed"
                      : "bg-white text-neutral-700 border-[#ececed] hover:bg-neutral-50"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reservations */}
          {table.reservations && table.reservations.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Reservas asociadas
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {table.reservations.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-neutral-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {r.customerName}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatTime(r.date)} · {r.partySize} pax · {r.shift === "LUNCH" ? "Comida" : "Cena"}
                      </p>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-[#ececed] text-neutral-600">
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-400 text-center py-3">
              No hay reservas próximas para esta mesa
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onEdit}>
              Editar mesa
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TableDialog({
  open,
  table,
  onClose,
  onSaved,
}: {
  open: boolean;
  table: Table | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [number, setNumber] = useState(table?.number || "");
  const [name, setName] = useState(table?.name || "");
  const [capacity, setCapacity] = useState(table?.capacity || 4);
  const [zone, setZone] = useState(table?.zone || "INTERIOR");
  const [shape, setShape] = useState(table?.shape || "SQUARE");
  const [status, setStatus] = useState(table?.status || "AVAILABLE");
  const [posX, setPosX] = useState(table?.posX || 0);
  const [posY, setPosY] = useState(table?.posY || 0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!number.trim()) {
      toast.error("El número es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        number: number.trim(),
        name: name.trim() || null,
        capacity: Number(capacity),
        zone,
        shape,
        status,
        posX: Number(posX),
        posY: Number(posY),
      };
      if (table) {
        await api(`/api/tables/${table.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Mesa actualizada");
      } else {
        await api("/api/tables", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Mesa creada");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!table) return;
    setDeleting(true);
    try {
      await api(`/api/tables/${table.id}`, { method: "DELETE" });
      toast.success("Mesa eliminada");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {table ? `Editar mesa ${table.number}` : "Nueva mesa"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Número *</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre (opcional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mesa ventana" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Capacidad</Label>
              <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Zona</Label>
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Forma</Label>
              <Select value={shape} onValueChange={setShape}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHAPES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Posición X (plano)</Label>
              <Input type="number" value={posX} onChange={(e) => setPosX(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Posición Y (plano)</Label>
              <Input type="number" value={posY} onChange={(e) => setPosY(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter className="flex items-center justify-between">
          {table ? (
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Eliminar
                </>
              )}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : table ? "Guardar cambios" : "Crear mesa"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
