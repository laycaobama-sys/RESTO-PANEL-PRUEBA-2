"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api"; import { formatDateTime } from "@/lib/format";
import { SectionHeader, EmptyState } from "@/components/shared/SectionHeader";
import { ReservationStatusBadge } from "@/components/shared/StatusBadge";
import {
  Plus,
  CalendarCheck,
  Loader2,
  Pencil,
  Trash2,
  Phone,
  Users,
  Clock,
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
  zone?: string | null;
  notes?: string | null;
  table?: { id: string; number: string; name?: string | null; zone: string } | null;
}

const STATUS = [
  { id: "PENDING", label: "Pendiente" },
  { id: "CONFIRMED", label: "Confirmada" },
  { id: "SEATED", label: "Sentados" },
  { id: "COMPLETED", label: "Completada" },
  { id: "CANCELLED", label: "Cancelada" },
];

export function ReservationsSection() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("ALL");
  const [dialog, setDialog] = useState<{ open: boolean; reservation?: Reservation }>({ open: false });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: reservations = [], isLoading } = useQuery<Reservation[]>({
    queryKey: ["reservations"],
    queryFn: () => api("/api/reservations"),
  });
  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: ["tables"],
    queryFn: () => api("/api/tables"),
  });

  const filtered = reservations
    .filter((r) => filter === "ALL" || r.status === filter)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayList = filtered.filter((r) => {
    const d = new Date(r.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });
  const upcoming = filtered.filter((r) => new Date(r.date) >= today && r.status !== "CANCELLED" && r.status !== "COMPLETED");

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
        subtitle="Gestión de reservas de clientes"
        actions={
          <Button
            className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white"
            onClick={() => setDialog({ open: true })}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nueva reserva
          </Button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Hoy" value={todayList.length} cls="bg-[#FFF3ED] text-[#9a3b18] border-[#FFE0CB]" />
        <SummaryCard label="Próximas" value={upcoming.length} cls="bg-blue-50 text-blue-700 border-blue-100" />
        <SummaryCard label="Confirmadas" value={reservations.filter((r) => r.status === "CONFIRMED").length} cls="bg-green-50 text-green-700 border-green-100" />
        <SummaryCard label="Pendientes" value={reservations.filter((r) => r.status === "PENDING").length} cls="bg-yellow-50 text-yellow-700 border-yellow-100" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[{ id: "ALL", label: "Todas" }, ...STATUS].map((f) => (
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
            icon={<CalendarCheck className="w-6 h-6" />}
            title="No hay reservas"
            description="Crea la primera reserva con el botón de arriba."
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#ececed] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-[#ececed]">
                <tr>
                  <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Personas</th>
                  <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3">Fecha y hora</th>
                  <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Mesa</th>
                  <th className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3">Estado</th>
                  <th className="text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ececed]">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{r.customerName}</p>
                      <p className="text-xs text-neutral-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {r.phone}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1 text-neutral-700">
                        <Users className="w-3.5 h-3.5 text-neutral-400" />
                        {r.partySize}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      <p>{formatDateTime(r.date)}</p>
                      {r.zone && (
                        <p className="text-xs text-neutral-500">Zona: {r.zone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {r.table ? (
                        <span className="text-neutral-700">Mesa {r.table.number}</span>
                      ) : (
                        <span className="text-neutral-400 text-xs">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ReservationStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {r.status === "PENDING" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => updateStatus.mutate({ id: r.id, status: "CONFIRMED" })}
                          >
                            Confirmar
                          </Button>
                        )}
                        {r.status === "CONFIRMED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => updateStatus.mutate({ id: r.id, status: "SEATED" })}
                          >
                            Sentar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-neutral-500 hover:text-[#FF6B35]"
                          onClick={() => setDialog({ open: true, reservation: r })}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-neutral-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteId(r.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ReservationDialog
        key={dialog.reservation?.id || "new"}
        open={dialog.open}
        reservation={dialog.reservation}
        tables={tables}
        onClose={() => setDialog({ open: false })}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["reservations"] });
          setDialog({ open: false });
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
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
              {delMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={cn("rounded-xl p-3 border", cls)}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}

function ReservationDialog({
  open,
  reservation,
  tables,
  onClose,
  onSaved,
}: {
  open: boolean;
  reservation?: Reservation;
  tables: Table[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const defaultDate = reservation ? new Date(reservation.date) : new Date();
  defaultDate.setMinutes(0, 0, 0);
  const localISO = (d: Date) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [customerName, setCustomerName] = useState(reservation?.customerName || "");
  const [phone, setPhone] = useState(reservation?.phone || "");
  const [email, setEmail] = useState(reservation?.email || "");
  const [partySize, setPartySize] = useState(reservation?.partySize?.toString() || "2");
  const [date, setDate] = useState(localISO(defaultDate));
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
            <Label className="text-xs">Zona</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERIOR">Interior</SelectItem>
                <SelectItem value="TERRACE">Terraza</SelectItem>
                <SelectItem value="BAR">Barra</SelectItem>
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
                    Mesa {t.number} ({t.capacity} pax)
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
            className="bg-[#FF6B35] hover:bg-[#F94B1E] text-white"
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
