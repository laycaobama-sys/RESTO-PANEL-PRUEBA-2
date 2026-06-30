"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDateTime, formatTime } from "@/lib/format";
import { SectionHeader, EmptyState } from "@/components/shared/SectionHeader";
import {
  ReservationStatusBadge,
  ZONE_LABEL,
  ZONE_COLOR,
  SHIFT_LABEL,
} from "@/components/shared/StatusBadge";
import {
  Plus,
  CalendarCheck,
  Loader2,
  Pencil,
  Trash2,
  Phone,
  Users,
  Clock,
  Calendar,
  Filter,
  Check,
  X,
  UserCheck,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Table {
  id: string;
  number: string;
  name?: string | null;
  capacity: number;
  zone: string;
}
interface Reservation {
  id: string;
  customerName: string;
  phone: string;
  email?: string | null;
  partySize: number;
  date: string;
  status: string;
  shift: string;
  zone?: string | null;
  source?: string | null;
  notes?: string | null;
  table?: { id: string; number: string; name?: string | null; zone: string } | null;
}

const STATUS = [
  { id: "PENDING", label: "Pendiente" },
  { id: "CONFIRMED", label: "Confirmada" },
  { id: "SEATED", label: "Sentados" },
  { id: "COMPLETED", label: "Completada" },
  { id: "CANCELLED", label: "Cancelada" },
  { id: "NO_SHOW", label: "No show" },
];

const SHIFTS = [
  { id: "ALL", label: "Todo el día" },
  { id: "LUNCH", label: "Comida" },
  { id: "DINNER", label: "Cena" },
];

const ZONES = [
  { id: "ALL", label: "Todas las zonas" },
  { id: "INTERIOR", label: "Interior" },
  { id: "TERRACE", label: "Terraza" },
  { id: "BAR", label: "Barra" },
  { id: "VIP", label: "VIP" },
];

function todayISO() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

export function ReservationsSection() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterShift, setFilterShift] = useState("ALL");
  const [filterZone, setFilterZone] = useState("ALL");
  const [filterDate, setFilterDate] = useState(todayISO());
  const [dialog, setDialog] = useState<{ open: boolean; reservation?: Reservation }>({ open: false });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: reservations = [], isLoading } = useQuery<Reservation[]>({
    queryKey: ["reservations", filterDate],
    queryFn: () => {
      const qs = new URLSearchParams({
        ...(filterDate ? { date: filterDate } : {}),
      }).toString();
      return api(`/api/reservations?${qs}`);
    },
  });
  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: ["tables"],
    queryFn: () => api("/api/tables"),
  });

  // Apply client-side filters (shift, status, zone) on top of date filter.
  const filtered = useMemo(() => {
    return reservations
      .filter((r) => filterStatus === "ALL" || r.status === filterStatus)
      .filter((r) => filterShift === "ALL" || r.shift === filterShift)
      .filter((r) => filterZone === "ALL" || r.zone === filterZone)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [reservations, filterStatus, filterShift, filterZone]);

  const groupedByHour = useMemo(() => {
    const groups = new Map<string, Reservation[]>();
    for (const r of filtered) {
      const d = new Date(r.date);
      const hour = d.getHours();
      const key = `${hour.toString().padStart(2, "0")}:00`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayList = filtered;
  const summary = {
    total: filtered.length,
    pending: filtered.filter((r) => r.status === "PENDING").length,
    confirmed: filtered.filter((r) => r.status === "CONFIRMED").length,
    seated: filtered.filter((r) => r.status === "SEATED").length,
    cancelled: filtered.filter((r) => r.status === "CANCELLED" || r.status === "NO_SHOW").length,
    pax: filtered
      .filter((r) => r.status !== "CANCELLED" && r.status !== "NO_SHOW")
      .reduce((s, r) => s + r.partySize, 0),
  };

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/api/reservations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMutation = useMutation({
    mutationFn: (id: string) => api(`/api/reservations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Reserva eliminada");
      qc.invalidateQueries({ queryKey: ["reservations"] });
      setDeleteId(null);
    },
  });

  return (
    <div>
      <SectionHeader
        title="Reservas"
        subtitle="Gestión de reservas por turno, zona y estado"
        actions={
          <Button
            className="bg-[#C5A059] hover:bg-[#b08d4e] text-white"
            onClick={() => setDialog({ open: true })}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nueva reserva
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3 mb-5">
        <SummaryCard label="Total" value={summary.total} cls="bg-[#111518] border" />
        <SummaryCard label="Pendientes" value={summary.pending} cls="bg-yellow-50 text-yellow-700 border border-yellow-100" />
        <SummaryCard label="Confirmadas" value={summary.confirmed} cls="bg-green-50 text-green-700 border border-green-100" />
        <SummaryCard label="Sentados" value={summary.seated} cls="bg-blue-50 text-blue-700 border border-blue-100" />
        <SummaryCard label="Cancelados" value={summary.cancelled} cls="bg-red-50 text-red-700 border border-red-100" />
        <SummaryCard label="Comensales" value={summary.pax} cls="bg-[#C5A05910] text-[#C5A059] border border-[#C5A05920]" />
      </div>

      {/* Filters bar */}
      <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-neutral-500 px-2">
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filtros:</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-neutral-400" />
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="h-8 w-auto border-white/[0.06] text-sm"
          />
        </div>
        <Select value={filterShift} onValueChange={setFilterShift}>
          <SelectTrigger className="h-8 w-auto text-sm border-white/[0.06]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHIFTS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterZone} onValueChange={setFilterZone}>
          <SelectTrigger className="h-8 w-auto text-sm border-white/[0.06]">
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
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-auto text-sm border-white/[0.06]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {STATUS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 ml-auto text-xs"
          onClick={() => {
            setFilterStatus("ALL");
            setFilterShift("ALL");
            setFilterZone("ALL");
            setFilterDate(todayISO());
          }}
        >
          Limpiar
        </Button>
      </div>

      {/* Reservations grouped by hour */}
      {isLoading ? (
        <div className="py-20 flex items-center justify-center text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#111518] rounded-2xl border border-white/[0.06]">
          <EmptyState
            icon={<CalendarCheck className="w-6 h-6" />}
            title="No hay reservas para los filtros seleccionados"
            description="Cambia los filtros o crea una nueva reserva con el botón de arriba."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByHour.map(([hour, items]) => (
            <div key={hour}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Clock className="w-4 h-4 text-[#C5A059]" />
                <h3 className="font-semibold text-[#f5f5f0] text-sm">{hour}</h3>
                <span className="text-xs text-neutral-500">
                  {items.length} reserva{items.length !== 1 ? "s" : ""} ·{" "}
                  {items
                    .filter((r) => r.status !== "CANCELLED" && r.status !== "NO_SHOW")
                    .reduce((s, r) => s + r.partySize, 0)}{" "}
                  comensales
                </span>
                <div className="flex-1 h-px bg-[#ececed] ml-2" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {items.map((r) => (
                  <ReservationCard
                    key={r.id}
                    reservation={r}
                    onEdit={() => setDialog({ open: true, reservation: r })}
                    onDelete={() => setDeleteId(r.id)}
                    onConfirm={() =>
                      updateStatus.mutate({ id: r.id, status: "CONFIRMED" })
                    }
                    onSeat={() =>
                      updateStatus.mutate({ id: r.id, status: "SEATED" })
                    }
                    onComplete={() =>
                      updateStatus.mutate({ id: r.id, status: "COMPLETED" })
                    }
                    onCancel={() =>
                      updateStatus.mutate({ id: r.id, status: "CANCELLED" })
                    }
                    onNoShow={() =>
                      updateStatus.mutate({ id: r.id, status: "NO_SHOW" })
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ReservationDialog
        key={dialog.reservation?.id || "new"}
        open={dialog.open}
        reservation={dialog.reservation}
        tables={tables}
        defaultDate={filterDate}
        onClose={() => setDialog({ open: false })}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["reservations"] });
          setDialog({ open: false });
        }}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteId && delMutation.mutate(deleteId)}
              disabled={delMutation.isPending}
            >
              {delMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({
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

function ReservationCard({
  reservation: r,
  onEdit,
  onDelete,
  onConfirm,
  onSeat,
  onComplete,
  onCancel,
  onNoShow,
}: {
  reservation: Reservation;
  onEdit: () => void;
  onDelete: () => void;
  onConfirm: () => void;
  onSeat: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onNoShow: () => void;
}) {
  return (
    <div className="bg-[#111518] rounded-xl border border-white/[0.06] p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        {/* Time + pax column */}
        <div className="flex flex-col items-center justify-center min-w-16 pr-3 border-r border-white/[0.06]">
          <p className="text-lg font-bold text-[#f5f5f0]">
            {formatTime(r.date)}
          </p>
          <div className="flex items-center gap-0.5 text-xs text-neutral-500 mt-0.5">
            <Users className="w-3 h-3" />
            {r.partySize}
          </div>
        </div>

        {/* Customer info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-[#f5f5f0] text-sm truncate">
                {r.customerName}
              </p>
              <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3" />
                {r.phone}
              </p>
            </div>
            <ReservationStatusBadge status={r.status} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {r.zone && (
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                  ZONE_COLOR[r.zone] || "bg-[#1a1f24] text-neutral-400"
                )}
              >
                {ZONE_LABEL[r.zone] || r.zone}
              </span>
            )}
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#1a1f24] text-neutral-400">
              {SHIFT_LABEL[r.shift] || r.shift}
            </span>
            {r.table && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#1a1f24] text-neutral-400">
                Mesa {r.table.number}
              </span>
            )}
            {r.source && r.source !== "PHONE" && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                {r.source === "ONLINE" ? "Online" : "Walk-in"}
              </span>
            )}
          </div>
          {r.notes && (
            <p className="text-xs text-neutral-500 mt-1.5 line-clamp-2 italic">
              "{r.notes}"
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/[0.06]">
        {r.status === "PENDING" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
            onClick={onConfirm}
          >
            <Check className="w-3 h-3 mr-1" />
            Confirmar
          </Button>
        )}
        {r.status === "CONFIRMED" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
            onClick={onSeat}
          >
            <UserCheck className="w-3 h-3 mr-1" />
            Sentar
          </Button>
        )}
        {r.status === "SEATED" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50"
            onClick={onComplete}
          >
            <Check className="w-3 h-3 mr-1" />
            Completar
          </Button>
        )}
        {(r.status === "PENDING" || r.status === "CONFIRMED") && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
              onClick={onCancel}
            >
              <X className="w-3 h-3 mr-1" />
              Cancelar
            </Button>
            {r.status === "CONFIRMED" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-neutral-500"
                onClick={onNoShow}
              >
                <UserX className="w-3 h-3 mr-1" />
                No show
              </Button>
            )}
          </>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-neutral-500 hover:text-[#C5A059]"
          onClick={onEdit}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-neutral-500 hover:text-red-600 hover:bg-red-50"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ReservationDialog({
  open,
  reservation,
  tables,
  defaultDate,
  onClose,
  onSaved,
}: {
  open: boolean;
  reservation?: Reservation;
  tables: Table[];
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const defaultDt = reservation
    ? new Date(reservation.date)
    : (() => {
        const d = new Date(defaultDate || todayISO());
        d.setHours(20, 0, 0, 0);
        return d;
      })();
  const localISO = (d: Date) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [customerName, setCustomerName] = useState(reservation?.customerName || "");
  const [phone, setPhone] = useState(reservation?.phone || "");
  const [email, setEmail] = useState(reservation?.email || "");
  const [partySize, setPartySize] = useState(reservation?.partySize?.toString() || "2");
  const [date, setDate] = useState(localISO(defaultDt));
  const [shift, setShift] = useState(reservation?.shift || "DINNER");
  const [zone, setZone] = useState(reservation?.zone || "INTERIOR");
  const [tableId, setTableId] = useState(reservation?.table?.id || "none");
  const [status, setStatus] = useState(reservation?.status || "PENDING");
  const [notes, setNotes] = useState(reservation?.notes || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!customerName.trim()) return toast.error("Nombre obligatorio");
    if (!phone.trim()) return toast.error("Teléfono obligatorio");
    setSaving(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        partySize: Number(partySize),
        date: new Date(date).toISOString(),
        shift,
        zone,
        tableId: tableId === "none" ? null : tableId,
        status,
        notes: notes.trim() || null,
      };
      if (reservation) {
        await api(`/api/reservations/${reservation.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Reserva actualizada");
      } else {
        await api("/api/reservations", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Reserva creada");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {reservation ? "Editar reserva" : "Nueva reserva"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre *</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="María García" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Teléfono *</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nº de personas</Label>
            <Input type="number" min={1} value={partySize} onChange={(e) => setPartySize(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fecha y hora</Label>
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Turno</Label>
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LUNCH">Comida</SelectItem>
                <SelectItem value="DINNER">Cena</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Zona</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERIOR">Interior</SelectItem>
                <SelectItem value="TERRACE">Terraza</SelectItem>
                <SelectItem value="BAR">Barra</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mesa</Label>
            <Select value={tableId} onValueChange={setTableId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {tables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name || `Mesa ${t.number}`} ({t.capacity} pax)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alergias, cumpleaños, preferencias..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            className="bg-[#C5A059] hover:bg-[#b08d4e] text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : reservation ? "Guardar" : "Crear reserva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
