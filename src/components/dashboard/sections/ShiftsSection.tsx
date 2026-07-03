"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SectionHeader, EmptyState } from "@/components/shared/SectionHeader";
import { Plus, Loader2, Trash2, Clock, Users, TrendingUp, Calendar, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Shift {
  id: string; staff_name: string; staff_avatar: string | null;
  team: string; date: string; start_time: string; end_time: string;
  role: string | null; notes: string | null; status: string;
}

const TEAMS = [
  { id: "SALA", label: "Sala", color: "#C5A059" },
  { id: "COCINA", label: "Cocina", color: "#ef4444" },
  { id: "BARRA", label: "Barra", color: "#3b82f6" },
  { id: "RECEPCION", label: "Recepción", color: "#22c55e" },
  { id: "EVENTOS", label: "Eventos", color: "#a855f7" },
];

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const TEAM_COLORS: Record<string, string> = Object.fromEntries(TEAMS.map(t => [t.id, t.color]));

function getWeekStart(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function ShiftsSection() {
  const qc = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [dialog, setDialog] = useState<{ open: boolean; shift?: Shift; defaultDate?: string }>({ open: false });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const weekStart = getWeekStart(currentDate);
  const weekDates = getWeekDates(weekStart);
  const weekStartISO = weekStart.toISOString().slice(0, 10);
  const weekDatesISO = weekDates.map(d => d.toISOString().slice(0, 10));

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ["shifts", weekStartISO, teamFilter],
    queryFn: () => {
      const qs = new URLSearchParams({ date: weekStartISO, ...(teamFilter !== "ALL" ? { team: teamFilter } : {}) }).toString();
      return api(`/api/shifts?${qs}`);
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/shifts/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Turno eliminado"); qc.invalidateQueries({ queryKey: ["shifts"] }); setDeleteId(null); },
  });

  // Group shifts by day — not memoized to avoid React Compiler issues
  const shiftsByDay = (() => {
    const map = new Map<string, Shift[]>();
    for (const iso of weekDatesISO) {
      map.set(iso, []);
    }
    for (const s of shifts) {
      const list = map.get(s.date);
      if (list) list.push(s);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  })();

  // Calculate stats
  const totalHours = shifts.reduce((sum, s) => {
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    return sum + (eh + em / 60 - sh - sm / 60);
  }, 0);
  const totalStaff = new Set(shifts.map(s => s.staff_name)).size;
  const teamCounts = TEAMS.map(t => ({ ...t, count: shifts.filter(s => s.team === t.id).length }));

  return (
    <div>
      <SectionHeader
        title="Turnos del personal"
        subtitle={`Semana del ${weekStart.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} al ${new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-neutral-400" onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-neutral-400" onClick={() => setCurrentDate(new Date())}>Hoy</Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-neutral-400" onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-8 w-auto text-xs bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los equipos</SelectItem>
                {TEAMS.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]" onClick={() => setDialog({ open: true, defaultDate: new Date().toISOString().slice(0, 10) })}>
              <Plus className="w-4 h-4 mr-1.5" /> Nuevo turno
            </Button>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
        <StatCard label="Horas totales" value={`${totalHours.toFixed(0)}h`} icon={<Clock className="w-4 h-4" />} cls="bg-[#111518] border-white/[0.06] text-[#f5f5f0]" />
        <StatCard label="Personal" value={totalStaff} icon={<Users className="w-4 h-4" />} cls="bg-[#C5A059]/10 border-[#C5A059]/20 text-[#C5A059]" />
        <StatCard label="Turnos" value={shifts.length} icon={<Calendar className="w-4 h-4" />} cls="bg-blue-500/10 border-blue-500/20 text-blue-400" />
        <StatCard label="Coste estimado" value={`${(totalHours * 12).toFixed(0)}€`} icon={<TrendingUp className="w-4 h-4" />} cls="bg-green-500/10 border-green-500/20 text-green-400" />
      </div>

      {/* Team badges */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {teamCounts.map(t => (
          <span key={t.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: `${t.color}30`, backgroundColor: `${t.color}10`, color: t.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.label}: {t.count}
          </span>
        ))}
      </div>

      {/* Weekly timeline */}
      {isLoading ? (
        <div className="py-20 flex items-center justify-center text-neutral-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 sm:gap-3">
          {weekDates.map((day, i) => {
            const dayKey = day.toISOString().slice(0, 10);
            const dayShifts = shiftsByDay.get(dayKey) || [];
            const isToday = day.toDateString() === new Date().toDateString();
            const dayHours = dayShifts.reduce((sum, s) => {
              const [sh, sm] = s.start_time.split(":").map(Number);
              const [eh, em] = s.end_time.split(":").map(Number);
              return sum + (eh + em / 60 - sh - sm / 60);
            }, 0);
            return (
              <motion.div
                key={dayKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
                className={cn(
                  "bg-[#111518]/80 backdrop-blur-xl rounded-xl border p-2.5 sm:p-3 min-h-[120px] sm:min-h-[200px]",
                  isToday ? "border-[#C5A059]/30" : "border-white/[0.06]"
                )}
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.04]">
                  <div>
                    <p className="text-xs font-semibold text-neutral-400">{DAYS[day.getDay()]}</p>
                    <p className={cn("text-lg font-bold", isToday ? "text-[#C5A059]" : "text-[#f5f5f0]")}>{day.getDate()}</p>
                  </div>
                  <span className="text-[10px] text-neutral-600">{dayHours.toFixed(0)}h</span>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {dayShifts.map(s => (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        whileHover={{ scale: 1.02 }}
                        className="group relative rounded-lg p-2 cursor-pointer border-l-2"
                        style={{ borderColor: TEAM_COLORS[s.team] || "#666", backgroundColor: `${TEAM_COLORS[s.team] || "#666"}08` }}
                        onClick={() => setDialog({ open: true, shift: s })}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] text-[#0a0a0a] flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                            {s.staff_name.slice(0, 1).toUpperCase()}
                          </div>
                          <p className="text-xs font-medium text-[#f5f5f0] truncate">{s.staff_name}</p>
                        </div>
                        <p className="text-[10px] text-neutral-500">{s.start_time} - {s.end_time}</p>
                        {s.role && <p className="text-[9px] text-neutral-600 mt-0.5">{s.role}</p>}
                        {s.status === "VACATION" && <span className="absolute top-1 right-1 text-[8px] px-1 rounded bg-blue-500/15 text-blue-400">VAC</span>}
                        {s.status === "ABSENT" && <span className="absolute top-1 right-1 text-[8px] px-1 rounded bg-red-500/15 text-red-400">FALTA</span>}
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteId(s.id); }}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {dayShifts.length === 0 && (
                    <button
                      onClick={() => setDialog({ open: true, defaultDate: dayKey })}
                      className="w-full py-4 text-center text-[10px] text-neutral-600 hover:text-[#C5A059] hover:bg-white/[0.02] rounded-lg transition-colors border border-dashed border-white/[0.04]"
                    >
                      <Plus className="w-3 h-3 mx-auto mb-0.5" /> Añadir turno
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <ShiftDialog
        key={dialog.shift?.id || dialog.defaultDate || "new"}
        open={dialog.open}
        shift={dialog.shift}
        defaultDate={dialog.defaultDate}
        onClose={() => setDialog({ open: false })}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["shifts"] }); setDialog({ open: false }); }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#111518] border-white/[0.06] text-[#f5f5f0]">
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar turno?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a1f24] border-white/[0.06] text-neutral-300">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteId && delMut.mutate(deleteId)} disabled={delMut.isPending}>{delMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Eliminar"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, icon, cls }: { label: string; value: string | number; icon: React.ReactNode; cls: string }) {
  return (
    <div className={cn("rounded-xl p-2.5 sm:p-3 border flex items-center gap-2 sm:gap-3", cls)}>
      <div className="opacity-60 flex-shrink-0">{icon}</div>
      <div className="min-w-0"><p className="text-base sm:text-xl font-bold leading-none truncate">{value}</p><p className="text-[9px] sm:text-[10px] opacity-60 mt-0.5 truncate">{label}</p></div>
    </div>
  );
}

function ShiftDialog({ open, shift, defaultDate, onClose, onSaved }: {
  open: boolean; shift?: Shift; defaultDate?: string; onClose: () => void; onSaved: () => void;
}) {
  const [staffName, setStaffName] = useState(shift?.staff_name || "");
  const [team, setTeam] = useState(shift?.team || "SALA");
  const [date, setDate] = useState(shift?.date || defaultDate || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(shift?.start_time || "10:00");
  const [endTime, setEndTime] = useState(shift?.end_time || "16:00");
  const [role, setRole] = useState(shift?.role || "");
  const [notes, setNotes] = useState(shift?.notes || "");
  const [status, setStatus] = useState(shift?.status || "CONFIRMED");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!staffName.trim()) return toast.error("Nombre del empleado obligatorio");
    setSaving(true);
    try {
      const payload = { staffName: staffName.trim(), team, date, startTime, endTime, role: role || null, notes: notes || null, status };
      if (shift) {
        await api(`/api/shifts/${shift.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Turno actualizado");
      } else {
        await api("/api/shifts", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Turno creado");
      }
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#111518] border-white/[0.06] text-[#f5f5f0]">
        <DialogHeader><DialogTitle className="text-[#f5f5f0]">{shift ? "Editar turno" : "Nuevo turno"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Empleado *</Label><Input value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="Juan Pérez" className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Equipo</Label><Select value={team} onValueChange={setTeam}><SelectTrigger className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]"><SelectValue /></SelectTrigger><SelectContent>{TEAMS.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Fecha</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Inicio</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Fin</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Rol</Label><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Camarero, Chef..." className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Estado</Label><Select value={status} onValueChange={setStatus}><SelectTrigger className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CONFIRMED">Confirmado</SelectItem><SelectItem value="PENDING">Pendiente</SelectItem><SelectItem value="VACATION">Vacaciones</SelectItem><SelectItem value="ABSENT">Ausente</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Notas</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas internas..." className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="bg-[#1a1f24] border-white/[0.06] text-neutral-300">Cancelar</Button>
          <Button className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : shift ? "Guardar" : "Crear turno"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
