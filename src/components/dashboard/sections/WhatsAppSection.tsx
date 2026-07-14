"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, MessageSquare, CheckCircle2, AlertCircle, Clock, Send, Settings } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface WhatsAppStatus {
  configured: boolean;
  queue: {
    queued: number;
    retrying: number;
    total: number;
    isConfigured: boolean;
  };
  recentMessages: Array<{
    id: string;
    to_phone: string;
    body: string;
    type: string;
    status: string;
    attempts: number;
    error: string | null;
    created_at: string;
  }>;
  config: {
    hasToken: boolean;
    hasPhoneNumberId: boolean;
    apiVersion: string;
  };
}

export function WhatsAppSection() {
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: status, isLoading, refetch } = useQuery<WhatsAppStatus>({
    queryKey: ["whatsapp-status"],
    queryFn: () => api("/api/whatsapp/status"),
    
  });

  async function handleTestSend(e: React.FormEvent) {
    e.preventDefault();
    if (!testPhone || !testMessage) return;
    setSending(true);
    try {
      const r = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testPhone, message: testMessage }),
      });
      const j = await r.json();
      if (r.ok) {
        alert("Mensaje encolado: " + j.messageId);
        setTestPhone("");
        setTestMessage("");
        refetch();
      } else {
        alert("Error: " + (j.message || j.error));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center text-neutral-500">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              status?.configured ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"
            )}>
              {status?.configured ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#f5f5f0]">WhatsApp Business</h2>
              <p className="text-xs text-neutral-500">
                {status?.configured
                  ? "Conectado y listo para enviar"
                  : "Pendiente de configuración (falta token)"}
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="text-xs text-neutral-400 hover:text-[#C5A059] flex items-center gap-1"
          >
            <Clock className="w-3.5 h-3.5" /> Actualizar
          </button>
        </div>

        {/* Config status */}
        <div className="grid grid-cols-3 gap-3">
          <ConfigItem
            label="API Token"
            value={status?.config.hasToken ? "Configurado" : "Pendiente"}
            ok={!!status?.config.hasToken}
          />
          <ConfigItem
            label="Phone Number ID"
            value={status?.config.hasPhoneNumberId ? "Configurado" : "Pendiente"}
            ok={!!status?.config.hasPhoneNumberId}
          />
          <ConfigItem
            label="API Version"
            value={status?.config.apiVersion || "v21.0"}
            ok={true}
          />
        </div>
      </div>

      {/* Queue status */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="En cola"
          value={status?.queue.queued || 0}
          color="text-yellow-400"
          bg="bg-yellow-500/10 border-yellow-500/20"
        />
        <StatCard
          icon={<AlertCircle className="w-4 h-4" />}
          label="Reintentando"
          value={status?.queue.retrying || 0}
          color="text-orange-400"
          bg="bg-orange-500/10 border-orange-500/20"
        />
        <StatCard
          icon={<MessageSquare className="w-4 h-4" />}
          label="Total en sistema"
          value={status?.queue.total || 0}
          color="text-[#C5A059]"
          bg="bg-[#C5A059]/10 border-[#C5A059]/20"
        />
      </div>

      {/* Test send */}
      {status?.configured && (
        <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#f5f5f0] mb-4 flex items-center gap-2">
            <Send className="w-4 h-4 text-[#C5A059]" /> Enviar mensaje de prueba
          </h3>
          <form onSubmit={handleTestSend} className="space-y-3">
            <div>
              <label className="text-xs text-neutral-400">Teléfono (formato internacional)</label>
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+34600000000"
                required
                className="w-full mt-1 bg-[#1a1f24] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-[#f5f5f0] outline-none focus:border-[#C5A059]"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400">Mensaje</label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Hola, este es un mensaje de prueba"
                required
                rows={3}
                className="w-full mt-1 bg-[#1a1f24] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-[#f5f5f0] outline-none focus:border-[#C5A059] resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] font-semibold text-sm px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar"}
            </button>
          </form>
        </div>
      )}

      {/* Recent messages */}
      <div className="bg-[#111518] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-[#f5f5f0]">Mensajes recientes</h3>
        </div>
        {status?.recentMessages?.length ? (
          <div className="divide-y divide-white/[0.04]">
            {status.recentMessages.map((msg) => (
              <div key={msg.id} className="px-5 py-3 flex items-start gap-3">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                  msg.status === "sent" ? "bg-green-400" :
                  msg.status === "failed" ? "bg-red-400" :
                  msg.status === "retrying" ? "bg-yellow-400 animate-pulse" :
                  "bg-neutral-500"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#f5f5f0] truncate">{msg.to_phone}</span>
                    <span className="text-[10px] text-neutral-500 flex-shrink-0">
                      {new Date(msg.created_at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">{msg.body}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-neutral-500 uppercase">{msg.type}</span>
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded uppercase font-medium",
                      msg.status === "sent" ? "bg-green-500/15 text-green-400" :
                      msg.status === "failed" ? "bg-red-500/15 text-red-400" :
                      msg.status === "retrying" ? "bg-yellow-500/15 text-yellow-400" :
                      "bg-neutral-500/15 text-neutral-400"
                    )}>
                      {msg.status}
                    </span>
                    {msg.attempts > 1 && (
                      <span className="text-[9px] text-neutral-500">intento {msg.attempts}</span>
                    )}
                    {msg.error && (
                      <span className="text-[9px] text-red-400/70 truncate">{msg.error}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-neutral-500 text-sm">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No hay mensajes enviados todavía
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={cn(
      "rounded-lg border p-3",
      ok ? "bg-green-500/5 border-green-500/15" : "bg-yellow-500/5 border-yellow-500/15"
    )}>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={cn("text-xs font-medium mt-1", ok ? "text-green-400" : "text-yellow-400")}>{value}</p>
    </div>
  );
}

function StatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: number; color: string; bg: string }) {
  return (
    <div className={cn("rounded-xl border p-4", bg)}>
      <div className={cn("flex items-center gap-1.5 mb-1", color)}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#f5f5f0]">{value}</p>
    </div>
  );
}
