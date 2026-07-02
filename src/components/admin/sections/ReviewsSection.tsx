"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star, Check, X, Reply, Trash2, AlertTriangle, Filter, Database, MessageSquare } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// SuperAdmin · Reviews moderation panel
// ============================================================
// Lists reviews submitted from the landing page (status PENDING /
// APPROVED / REJECTED) and lets the super admin:
//   - approve / reject a review
//   - reply publicly (sets response_text + response_at)
//   - mark a verified metric (e.g. "+30% ocupación")
//   - hard delete a review
// ============================================================

interface PublicReview {
  id: string;
  author_name: string;
  author_role: "CLIENT" | "COMPANY";
  author_company: string | null;
  author_email: string | null;
  rating: number;
  title: string | null;
  body: string;
  tags: string[] | null;
  source: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  verified_metric: string | null;
  response_text: string | null;
  response_at: string | null;
  created_at: string;
  organization_id: string | null;
}

interface ReviewsResponse {
  reviews: PublicReview[];
  counts: {
    PENDING: number;
    APPROVED: number;
    REJECTED: number;
    TOTAL: number;
  };
  tableMissing?: boolean;
}

const STATUS_FILTERS = [
  { id: "PENDING", label: "Pendientes", color: "text-[#C5A059]" },
  { id: "APPROVED", label: "Aprobadas", color: "text-green-400" },
  { id: "REJECTED", label: "Rechazadas", color: "text-red-400" },
  { id: "ALL", label: "Todas", color: "text-neutral-400" },
] as const;

export function ReviewsSection() {
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseDraft, setResponseDraft] = useState("");
  const [metricDraft, setMetricDraft] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<ReviewsResponse>({
    queryKey: ["admin-reviews", statusFilter],
    queryFn: async () => {
      const qs = statusFilter !== "ALL" ? `?status=${statusFilter}&limit=50` : "?limit=50";
      const r = await fetch(`/api/admin/reviews${qs}`);
      if (!r.ok) throw new Error("Failed to load reviews");
      return r.json();
    },
    refetchInterval: 15000, // auto-refresh every 15s
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; status?: string; response_text?: string; verified_metric?: string }) => {
      const r = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Update failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
  });

  const reviews = data?.reviews || [];
  const counts = data?.counts || { PENDING: 0, APPROVED: 0, REJECTED: 0, TOTAL: 0 };
  const tableMissing = data?.tableMissing;

  return (
    <div className="space-y-4">
      {/* Header / migration warning */}
      {tableMissing && (
        <div className="bg-[#C5A059]/10 border border-[#C5A059]/30 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
          <Database className="w-5 h-5 text-[#C5A059] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#f5f5f0]">Tabla de reseñas no encontrada</p>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Ejecuta <code className="font-mono text-[#C5A059]">supabase/migrations/0009_google_reviews.sql</code> en
              el SQL Editor de Supabase para activar el sistema de reseñas. Hasta entonces, las reseñas enviadas desde la
              landing no se persisten.
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Pendientes" value={counts.PENDING} icon={<AlertTriangle className="w-4 h-4" />} accent="#C5A059" />
        <KpiCard label="Aprobadas" value={counts.APPROVED} icon={<Check className="w-4 h-4" />} accent="#22c55e" />
        <KpiCard label="Rechazadas" value={counts.REJECTED} icon={<X className="w-4 h-4" />} accent="#ef4444" />
        <KpiCard label="Total" value={counts.TOTAL} icon={<MessageSquare className="w-4 h-4" />} accent="#71717a" />
      </div>

      {/* Filters */}
      <div className="bg-[#16161a] rounded-xl border border-[#27272a] p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-neutral-400 px-2">
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filtrar por estado:</span>
        </div>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors border",
              statusFilter === f.id
                ? "bg-[#C5A059] text-[#0a0a0a] border-[#C5A059]"
                : "bg-[#1f1f23] text-neutral-400 border-[#27272a] hover:bg-[#27272a]"
            )}
          >
            {f.label}
            {f.id !== "ALL" && counts[f.id as keyof typeof counts] > 0 && (
              <span className={cn("ml-1.5 font-bold", statusFilter === f.id ? "text-[#0a0a0a]" : f.color)}>
                {counts[f.id as keyof typeof counts]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-12 flex items-center justify-center text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-[#16161a] rounded-2xl border border-[#27272a] py-12 text-center text-neutral-500">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
          No hay reseñas en este estado.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <ReviewModerationCard
              key={r.id}
              review={r}
              isResponding={respondingTo === r.id}
              responseDraft={responseDraft}
              metricDraft={metricDraft}
              onToggleRespond={() => {
                if (respondingTo === r.id) {
                  setRespondingTo(null);
                } else {
                  setRespondingTo(r.id);
                  setResponseDraft(r.response_text || "");
                  setMetricDraft(r.verified_metric || "");
                }
              }}
              onResponseDraftChange={setResponseDraft}
              onMetricDraftChange={setMetricDraft}
              onApprove={() => updateMutation.mutate({ id: r.id, status: "APPROVED" })}
              onReject={() => updateMutation.mutate({ id: r.id, status: "REJECTED" })}
              onSaveResponse={() => {
                updateMutation.mutate(
                  { id: r.id, response_text: responseDraft, verified_metric: metricDraft },
                  { onSuccess: () => setRespondingTo(null) }
                );
              }}
              onDelete={() => {
                if (confirm(`¿Eliminar definitivamente la reseña de "${r.author_name}"?`)) {
                  deleteMutation.mutate(r.id);
                }
              }}
              isUpdating={updateMutation.isPending || deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent: string }) {
  return (
    <div className="bg-[#16161a] rounded-xl border border-[#27272a] p-3.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-[#f5f5f0]">{value}</p>
    </div>
  );
}

function ReviewModerationCard({
  review,
  isResponding,
  responseDraft,
  metricDraft,
  onToggleRespond,
  onResponseDraftChange,
  onMetricDraftChange,
  onApprove,
  onReject,
  onSaveResponse,
  onDelete,
  isUpdating,
}: {
  review: PublicReview;
  isResponding: boolean;
  responseDraft: string;
  metricDraft: string;
  onToggleRespond: () => void;
  onResponseDraftChange: (v: string) => void;
  onMetricDraftChange: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onSaveResponse: () => void;
  onDelete: () => void;
  isUpdating: boolean;
}) {
  const statusColor =
    review.status === "APPROVED"
      ? "bg-green-500/15 border-green-500/30 text-green-400"
      : review.status === "REJECTED"
      ? "bg-red-500/15 border-red-500/30 text-red-400"
      : "bg-[#C5A059]/15 border-[#C5A059]/30 text-[#C5A059]";

  const initial = (review.author_name || review.author_company || "A").slice(0, 1).toUpperCase();

  return (
    <div className="bg-[#16161a] rounded-2xl border border-[#27272a] overflow-hidden">
      <div className="p-4 sm:p-5">
        {/* Top row: avatar + author + status */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] text-[#0a0a0a] flex items-center justify-center text-sm font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-[#f5f5f0]">{review.author_name}</span>
              <span className={cn("text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium border", statusColor)}>
                {review.status}
              </span>
              {review.author_role === "COMPANY" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#004D40]/30 border border-[#004D40]/50 text-[#5fc7b8] font-medium uppercase tracking-wider">
                  Empresa
                </span>
              )}
              {review.source === "GOOGLE" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400 font-medium uppercase tracking-wider">
                  Google
                </span>
              )}
            </div>
            {review.author_company && <p className="text-xs text-neutral-500">{review.author_company}</p>}
            {review.author_email && <p className="text-[10px] text-neutral-600">{review.author_email}</p>}
            <p className="text-[10px] text-neutral-600 mt-0.5">
              {new Date(review.created_at).toLocaleString("es-ES", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={cn(
                  "w-3.5 h-3.5",
                  s <= review.rating ? "fill-[#C5A059] text-[#C5A059]" : "fill-neutral-700 text-neutral-700"
                )}
              />
            ))}
          </div>
        </div>

        {/* Title + body */}
        {review.title && <p className="text-sm font-medium text-[#f5f5f0] mb-1.5">{review.title}</p>}
        <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{review.body}</p>

        {/* Tags */}
        {review.tags && review.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {review.tags.map((t, i) => (
              <span
                key={i}
                className="text-[10px] text-neutral-400 bg-white/[0.04] border border-white/[0.08] rounded-full px-2 py-0.5"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Existing response */}
        {review.response_text && !isResponding && (
          <div className="mt-3 pl-3 border-l-2 border-[#C5A059]/40 bg-[#C5A059]/5 rounded-r p-3">
            <p className="text-[10px] text-[#C5A059] font-semibold uppercase tracking-wider mb-1">
              Respuesta pública actual
            </p>
            <p className="text-xs text-neutral-300 leading-relaxed">{review.response_text}</p>
            {review.response_at && (
              <p className="text-[10px] text-neutral-600 mt-1.5">
                Respondida el {new Date(review.response_at).toLocaleString("es-ES")}
              </p>
            )}
          </div>
        )}

        {/* Verified metric */}
        {review.verified_metric && (
          <span className="inline-flex items-center gap-1 mt-3 text-[10px] text-[#C5A059] font-bold bg-[#C5A059]/10 px-2 py-1 rounded-md">
            <Check className="w-3 h-3" />
            Métrica verificada: {review.verified_metric}
          </span>
        )}

        {/* Response editor */}
        {isResponding && (
          <div className="mt-3 bg-black/30 border border-white/[0.06] rounded-xl p-3 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                Respuesta pública
              </label>
              <textarea
                value={responseDraft}
                onChange={(e) => onResponseDraftChange(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Ej: ¡Gracias por tu reseña! Sentimos mucho lo del tiempo de espera. Estamos trabajando en ello."
                className="mt-1 w-full bg-[#1f1f23] border border-[#27272a] focus:border-[#C5A059] rounded-lg px-3 py-2 text-sm text-[#f5f5f0] placeholder:text-neutral-600 outline-none resize-none"
              />
              <p className="text-[10px] text-neutral-600 mt-1 text-right">{responseDraft.length}/2000</p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                Métrica verificada <span className="normal-case text-neutral-600">(opcional)</span>
              </label>
              <input
                type="text"
                value={metricDraft}
                onChange={(e) => onMetricDraftChange(e.target.value)}
                maxLength={80}
                placeholder="Ej: +30% ocupación"
                className="mt-1 w-full bg-[#1f1f23] border border-[#27272a] focus:border-[#C5A059] rounded-lg px-3 py-2 text-sm text-[#f5f5f0] placeholder:text-neutral-600 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={onSaveResponse}
                disabled={isUpdating}
                className="flex-1 bg-[#C5A059] hover:bg-[#b08d4e] disabled:opacity-60 text-[#0a0a0a] text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Guardar respuesta
              </button>
              <button
                onClick={onToggleRespond}
                className="px-3 bg-[#27272a] hover:bg-[#3f3f46] text-neutral-300 text-xs py-2 rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isResponding && (
          <div className="mt-3 pt-3 border-t border-[#27272a] flex flex-wrap items-center gap-2">
            {review.status !== "APPROVED" && (
              <button
                onClick={onApprove}
                disabled={isUpdating}
                className="inline-flex items-center gap-1.5 bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-400 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
              >
                <Check className="w-3.5 h-3.5" />
                Aprobar
              </button>
            )}
            {review.status !== "REJECTED" && (
              <button
                onClick={onReject}
                disabled={isUpdating}
                className="inline-flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
              >
                <X className="w-3.5 h-3.5" />
                Rechazar
              </button>
            )}
            <button
              onClick={onToggleRespond}
              className="inline-flex items-center gap-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-neutral-300 text-xs font-medium px-3 py-1.5 rounded-lg"
            >
              <Reply className="w-3.5 h-3.5" />
              {review.response_text ? "Editar respuesta" : "Responder"}
            </button>
            <button
              onClick={onDelete}
              disabled={isUpdating}
              className="ml-auto inline-flex items-center gap-1.5 bg-transparent hover:bg-red-500/15 text-red-400/70 hover:text-red-400 text-xs font-medium px-2 py-1.5 rounded-lg disabled:opacity-60"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
