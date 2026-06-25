"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SectionHeader, EmptyState } from "@/components/shared/SectionHeader";
import { TableStatusBadge, ZONE_LABEL } from "@/components/shared/StatusBadge";
import {
  Plus,
  Grid3x3,
  Loader2,
  Pencil,
  Trash2,
  Users,
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

interface Table {
  id: string;
  number: string;
  name?: string | null;
  capacity: number;
  zone: string;
  status: string;
}

const ZONES = [
  { id: "INTERIOR", label: "Interior" },
  { id: "TERRACE", label: "Terraza" },
  { id: "BAR", label: "Barra" },
];

const STATUS = [
  { id: "AVAILABLE", label: "Disponible" },
  { id: "OCCUPIED", label: "Ocupada" },
  { id: "RESERVED", label: "Reservada" },
  { id: "PREPARING", label: "En preparación" },
];

export function TablesSection() {
  const qc = useQueryClient();
  const { data: tables = [], isLoading } = useQuery<Table[]>({
    queryKey: ["tables"],
    queryFn: () => api("/api/tables"),
  });
  const [editing, setEditing] = useState<Table | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("ALL");

  const filtered = tables.filter((t) => filter === "ALL" || t.status === filter);

  const summary = {
    total: tables.length,
    available: tables.filter((t) => t.status === "AVAILABLE").length,
    occupied: tables.filter((t) => t.status === "OCCUPIED").length,
    reserved: tables.filter((t) => t.status === "RESERVED").length,
    preparing: tables.filter((t) => t.status === "PREPARING").length,
  };

  return (
    <div>
      <SectionHeader
        title="Mesas"
        subtitle="Estado y configuración de las mesas del restaurante"
        actions={
          <Button
            className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white"
            onClick={() => setCreating(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Añadir mesa
          </Button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <SummaryPill label="Total" value={summary.total} cls="bg-white border" />
        <SummaryPill label="Libres" value={summary.available} cls="bg-green-50 text-green-700 border border-green-100" />
        <SummaryPill label="Ocupadas" value={summary.occupied} cls="bg-red-50 text-red-700 border border-red-100" />
        <SummaryPill label="Reservadas" value={summary.reserved} cls="bg-yellow-50 text-yellow-700 border border-yellow-100" />
        <SummaryPill label="Preparando" value={summary.preparing} cls="bg-blue-50 text-blue-700 border border-blue-100" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { id: "ALL", label: "Todas" },
          ...STATUS,
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap border transition-colors",
              filter === f.id
                ? "bg-[#FF6B35] text-white border-[#FF6B35]"
                : "bg-white text-neutral-600 border-[#ececed] hover:bg-neutral-50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-20 flex items-center justify-center text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#ececed]">
          <EmptyState
            icon={<Grid3x3 className="w-6 h-6" />}
            title="No hay mesas"
            description="Crea tu primera mesa para empezar a gestionar el salón."
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((t) => (
            <TableCard key={t.id} table={t} onEdit={() => setEditing(t)} />
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
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
    <div className={cn("rounded-xl p-3", cls)}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}

function TableCard({ table, onEdit }: { table: Table; onEdit: () => void }) {
  const zoneColor: Record<string, string> = {
    INTERIOR: "bg-indigo-50 text-indigo-600",
    TERRACE: "bg-green-50 text-green-600",
    BAR: "bg-amber-50 text-amber-600",
  };
  return (
    <button
      onClick={onEdit}
      className="bg-white rounded-2xl border border-[#ececed] p-4 text-left hover:shadow-md hover:border-[#FF6B35]/40 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center">
          <Grid3x3 className="w-5 h-5 text-neutral-500" />
        </div>
        <span
          className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full",
            zoneColor[table.zone]
          )}
        >
          {ZONE_LABEL[table.zone]}
        </span>
      </div>
      <p className="font-semibold text-neutral-900">
        {table.name || `Mesa ${table.number}`}
      </p>
      <div className="flex items-center gap-1 text-xs text-neutral-500 mt-0.5">
        <Users className="w-3 h-3" />
        {table.capacity} personas
      </div>
      <div className="mt-3">
        <TableStatusBadge status={table.status} />
      </div>
    </button>
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
  const [status, setStatus] = useState(table?.status || "AVAILABLE");
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
        status,
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
      // Reset
      setNumber("");
      setName("");
      setCapacity(4);
      setZone("INTERIOR");
      setStatus("AVAILABLE");
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
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre (opcional)</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mesa ventana"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Capacidad</Label>
              <Input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
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
        </div>
        <DialogFooter className="flex items-center justify-between">
          {table ? (
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
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
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>{table ? "Guardar cambios" : "Crear mesa"}</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
