"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatCurrency, formatDateTime } from "@/lib/api"; import { formatCurrency as fmtCur, formatDateTime as fmtDt } from "@/lib/format";
import { SectionHeader, EmptyState } from "@/components/shared/SectionHeader";
import {
  Plus, Search, Loader2, Pencil, Trash2, Eye, Star, Phone, Mail, Users, Crown, Calendar, TrendingUp, X, Check, AlertCircle, Tag, Clock, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface CustomerTag { id: string; name: string; color: string }
interface Customer {
  id: string; fullName: string; phone: string; email: string | null;
  photoUrl: string | null; notes: string | null; preferences: string | null;
  allergies: string | null; rating: number; vipStatus: boolean;
  totalSpend: number; averageTicket: number; visitsCount: number;
  cancellationsCount: number; noShowsCount: number; lastVisitAt: string | null;
  tags: CustomerTag[]; createdAt: string;
}

export function CustomersSection() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [vipOnly, setVipOnly] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["customers", search, vipOnly],
    queryFn: () => {
      const qs = new URLSearchParams({
        ...(search ? { q: search } : {}),
        ...(vipOnly ? { vip: "true" } : {}),
      }).toString();
      return api(`/api/customers?${qs}`);
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Cliente eliminado");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDeleteId(null);
    },
  });

  const stats = {
    total: customers.length,
    vip: customers.filter(c => c.vipStatus).length,
    avgTicket: customers.length > 0 ? customers.reduce((s, c) => s + c.averageTicket, 0) / customers.length : 0,
    totalVisits: customers.reduce((s, c) => s + c.visitsCount, 0),
  };

  return (
    <div>
      <SectionHeader
        title="Clientes (CRM)"
        subtitle="Fichas de clientes, historial y fidelización"
        actions={
          <Button className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Nuevo cliente
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatPill label="Total clientes" value={stats.total} icon={<Users className="w-4 h-4" />} cls="bg-[#111518] border-white/[0.06] text-[#f5f5f0]" />
        <StatPill label="Clientes VIP" value={stats.vip} icon={<Crown className="w-4 h-4" />} cls="bg-[#C5A059]/10 border-[#C5A059]/20 text-[#C5A059]" />
        <StatPill label="Ticket medio" value={fmtCur(stats.avgTicket)} icon={<TrendingUp className="w-4 h-4" />} cls="bg-green-500/10 border-green-500/20 text-green-400" />
        <StatPill label="Visitas totales" value={stats.totalVisits} icon={<Calendar className="w-4 h-4" />} cls="bg-blue-500/10 border-blue-500/20 text-blue-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <Input placeholder="Buscar por nombre, teléfono o email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0] placeholder:text-neutral-600" />
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer bg-[#1a1f24] border border-white/[0.06] rounded-lg px-3 h-10">
          <Switch checked={vipOnly} onCheckedChange={setVipOnly} className="data-[state=checked]:bg-[#C5A059]" />
          Solo VIP
        </label>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="py-20 flex items-center justify-center text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-[#111518] rounded-2xl border border-white/[0.06]">
          <EmptyState icon={<Users className="w-6 h-6" />} title="Sin clientes" description="Crea tu primer cliente o importalos desde tus reservas existentes." action={<Button className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]" onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1.5" /> Nuevo cliente</Button>} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <AnimatePresence>
            {customers.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
                whileHover={{ y: -2 }}
                className="bg-[#111518] rounded-xl border border-white/[0.06] p-4 hover:border-[#C5A059]/20 transition-all cursor-pointer"
                onClick={() => setSelected(c)}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0", c.vipStatus ? "bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] text-[#0a0a0a]" : "bg-[#1a1f24] text-neutral-400")}>
                    {c.photoUrl ? <img src={c.photoUrl} alt={c.fullName} className="w-full h-full object-cover rounded-full" /> : c.fullName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-[#f5f5f0] text-sm truncate">{c.fullName}</p>
                      {c.vipStatus && <Crown className="w-3.5 h-3.5 text-[#C5A059] flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-neutral-500 truncate">{c.phone}</p>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {[1,2,3,4,5].map(s => <Star key={s} className={cn("w-2.5 h-2.5", s <= c.rating ? "fill-[#C5A059] text-[#C5A059]" : "text-neutral-700")} />)}
                    </div>
                  </div>
                </div>
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {c.tags.slice(0, 3).map(t => <span key={t.id} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${t.color}20`, color: t.color }}>{t.name}</span>)}
                    {c.tags.length > 3 && <span className="text-[9px] text-neutral-500">+{c.tags.length - 3}</span>}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-neutral-500 pt-2 border-t border-white/[0.06]">
                  <span>{c.visitsCount} visitas</span>
                  <span className="font-medium text-[#C5A059]">{fmtCur(c.averageTicket)}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Detail dialog */}
      <CustomerDetailDialog customerId={selected?.id || null} onClose={() => setSelected(null)} onEdit={(c) => { setSelected(null); setEditing(c); }} onDelete={(id) => { setSelected(null); setDeleteId(id); }} />

      {/* Create/Edit dialog */}
      <CustomerDialog open={creating || !!editing} customer={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { qc.invalidateQueries({ queryKey: ["customers"] }); setCreating(false); setEditing(null); }} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#111518] border-white/[0.06] text-[#f5f5f0]">
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer. Se mantendrán las reservas históricas pero se perderá la ficha del cliente.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a1f24] border-white/[0.06] text-neutral-300">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteId && delMut.mutate(deleteId)} disabled={delMut.isPending}>{delMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Eliminar"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatPill({ label, value, icon, cls }: { label: string; value: string | number; icon: React.ReactNode; cls: string }) {
  return (
    <div className={cn("rounded-xl p-3 border flex items-center gap-3", cls)}>
      <div className="opacity-80">{icon}</div>
      <div>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-[10px] opacity-60">{label}</p>
      </div>
    </div>
  );
}

// ─── Customer detail dialog (ficha completa) ──────────────────
function CustomerDetailDialog({ customerId, onClose, onEdit, onDelete }: { customerId: string | null; onClose: () => void; onEdit: (c: Customer) => void; onDelete: (id: string) => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["customer-detail", customerId],
    queryFn: () => api(`/api/customers/${customerId}`),
    enabled: !!customerId,
  });

  return (
    <Dialog open={!!customerId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#111518] border-white/[0.06] text-[#f5f5f0]">
        <DialogHeader><DialogTitle className="text-[#f5f5f0]">Ficha de cliente</DialogTitle></DialogHeader>
        {isLoading || !data ? (
          <div className="py-12 flex items-center justify-center text-neutral-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            {/* Header: photo + name + tags */}
            <div className="flex items-start gap-4">
              <div className={cn("w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0", data.vipStatus ? "bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] text-[#0a0a0a]" : "bg-[#1a1f24] text-neutral-400")}>
                {data.photoUrl ? <img src={data.photoUrl} alt={data.fullName} className="w-full h-full object-cover rounded-full" /> : data.fullName.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-[#f5f5f0]">{data.fullName}</h3>
                  {data.vipStatus && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C5A059] text-[#0a0a0a] uppercase">VIP</span>}
                </div>
                <div className="flex items-center gap-3 text-sm text-neutral-400 mt-1">
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{data.phone}</span>
                  {data.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{data.email}</span>}
                </div>
                <div className="flex items-center gap-0.5 mt-1">
                  {[1,2,3,4,5].map(s => <Star key={s} className={cn("w-3.5 h-3.5", s <= data.rating ? "fill-[#C5A059] text-[#C5A059]" : "text-neutral-700")} />)}
                </div>
              </div>
            </div>

            {/* Tags */}
            {data.tags && data.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.tags.map((t: any) => <span key={t.id} className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: `${t.color}20`, color: t.color }}>{t.name}</span>)}
              </div>
            )}

            {/* Behavior metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric label="Visitas" value={data.behavior?.visitsCount ?? 0} icon={<Calendar className="w-3.5 h-3.5" />} />
              <Metric label="Ticket medio" value={fmtCur(data.behavior?.averageTicket ?? 0)} icon={<TrendingUp className="w-3.5 h-3.5" />} />
              <Metric label="Cancelaciones" value={data.behavior?.cancellationsCount ?? 0} icon={<X className="w-3.5 h-3.5" />} cls="text-red-400" />
              <Metric label="No-shows" value={data.behavior?.noShowsCount ?? 0} icon={<AlertCircle className="w-3.5 h-3.5" />} cls="text-purple-400" />
            </div>

            {/* Notes / preferences / allergies */}
            {(data.notes || data.preferences || data.allergies) && (
              <div className="space-y-2">
                {data.notes && <InfoRow label="Notas" value={data.notes} />}
                {data.preferences && <InfoRow label="Preferencias" value={data.preferences} />}
                {data.allergies && <InfoRow label="Alergias" value={data.allergies} cls="text-red-400" />}
              </div>
            )}

            {/* Reservation history */}
            <div>
              <h4 className="text-sm font-semibold text-[#f5f5f0] mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#C5A059]" /> Historial de reservas</h4>
              {(!data.reservations || data.reservations.length === 0) ? (
                <p className="text-sm text-neutral-500 py-3 text-center">Sin reservas registradas</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {data.reservations.map((r: any) => (
                    <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#1a1f24] text-xs">
                      <span className="text-neutral-300 whitespace-nowrap">{fmtDt(r.date)}</span>
                      <span className="text-neutral-500">{r.partySize} pax</span>
                      {r.table && <span className="text-neutral-500">Mesa {r.table.number}</span>}
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ml-auto", r.status === "COMPLETED" ? "bg-green-500/15 text-green-400" : r.status === "CANCELLED" ? "bg-red-500/15 text-red-400" : r.status === "NO_SHOW" ? "bg-purple-500/15 text-purple-400" : "bg-yellow-500/15 text-yellow-400")}>{r.status.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
              <Button className="flex-1 bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]" onClick={() => onEdit(data)}><Pencil className="w-4 h-4 mr-1.5" /> Editar</Button>
              <Button variant="outline" className="text-red-400 border-red-500/20 hover:bg-red-500/10" onClick={() => onDelete(data.id)}><Trash2 className="w-4 h-4 mr-1.5" /> Eliminar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value, icon, cls }: { label: string; value: string | number; icon: React.ReactNode; cls?: string }) {
  return (
    <div className="bg-[#1a1f24] rounded-lg p-2.5">
      <div className={cn("flex items-center gap-1 text-neutral-500 mb-1", cls)}>{icon}<span className="text-[10px]">{label}</span></div>
      <p className={cn("text-lg font-bold text-[#f5f5f0]", cls)}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-[#1a1f24]">
      <p className="text-[10px] font-semibold text-neutral-500 uppercase mb-0.5">{label}</p>
      <p className={cn("text-sm text-neutral-300", cls)}>{value}</p>
    </div>
  );
}

// ─── Create/Edit dialog ───────────────────────────────────────
function CustomerDialog({ open, customer, onClose, onSaved }: { open: boolean; customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(customer?.fullName || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [notes, setNotes] = useState(customer?.notes || "");
  const [preferences, setPreferences] = useState(customer?.preferences || "");
  const [allergies, setAllergies] = useState(customer?.allergies || "");
  const [rating, setRating] = useState(customer?.rating || 0);
  const [vipStatus, setVipStatus] = useState(customer?.vipStatus || false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!fullName.trim() || !phone.trim()) { toast.error("Nombre y teléfono obligatorios"); return; }
    setSaving(true);
    try {
      const payload = { fullName: fullName.trim(), phone: phone.trim(), email: email.trim() || null, notes: notes.trim() || null, preferences: preferences.trim() || null, allergies: allergies.trim() || null, rating, vipStatus };
      if (customer) {
        await api(`/api/customers/${customer.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Cliente actualizado");
      } else {
        await api("/api/customers", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Cliente creado");
      }
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#111518] border-white/[0.06] text-[#f5f5f0]">
        <DialogHeader><DialogTitle className="text-[#f5f5f0]">{customer ? "Editar cliente" : "Nuevo cliente"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Nombre completo *</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="María García" className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Teléfono *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Valoración (0-5)</Label><Input type="number" min={0} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value))} className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-neutral-400">VIP</Label><div className="flex items-center h-10"><Switch checked={vipStatus} onCheckedChange={setVipStatus} className="data-[state=checked]:bg-[#C5A059]" /></div></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Preferencias</Label><Input value={preferences} onChange={(e) => setPreferences(e.target.value)} placeholder="Mesa ventana, vino tinto..." className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
          <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Alergias</Label><Input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Gluten, frutos secos..." className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
          <div className="space-y-1.5"><Label className="text-xs text-neutral-400">Notas internas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cumpleaños el 15 de junio, cliente frecuente..." rows={2} className="bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="bg-[#1a1f24] border-white/[0.06] text-neutral-300">Cancelar</Button>
          <Button className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a]" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : customer ? "Guardar" : "Crear cliente"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
