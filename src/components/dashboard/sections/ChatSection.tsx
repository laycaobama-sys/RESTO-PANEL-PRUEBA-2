"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SectionHeader, EmptyState } from "@/components/shared/SectionHeader";
import { Send, Loader2, Hash, AlertTriangle, Bell, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Channel { id: string; name: string; slug: string; icon: string; sort_order: number }
interface Message {
  id: string; channel_id: string; user_id: string; user_name: string;
  content: string; priority: string; created_at: string;
}

export function ChatSection() {
  const qc = useQueryClient();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent" | "alert">("normal");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["chat-channels"],
    queryFn: () => api("/api/chat/channels"),
  });

  // Auto-select the first channel when channels load
  const currentChannel = selectedChannel || channels[0]?.id || null;

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["chat-messages", currentChannel],
    queryFn: () => api(`/api/chat/messages?channelId=${currentChannel}&limit=100`),
    enabled: !!currentChannel,
    refetchInterval: 5000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMut = useMutation({
    mutationFn: (content: string) =>
      api("/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({ channelId: currentChannel, content, priority }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages", currentChannel] });
      setMessage("");
      setPriority("normal");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const quickMessages = [
    "🟢 Mesa lista para servir",
    "🔴 Comanda retrasada, necesito ayuda",
    "⚠️ Incidencia en mesa",
    "🍽️ Plato agotado",
    "🧹 Mesa necesita limpieza",
    "📦 Faltan existencias",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] sm:h-[calc(100vh-200px)]">
      <SectionHeader
        title="Chat interno"
        subtitle="Comunicación entre sala, cocina y barra"
        actions={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> En vivo
            </span>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row flex-1 gap-2 sm:gap-4 min-h-0">
        {/* Channels — horizontal scroll on mobile, sidebar on desktop */}
        <div className="sm:w-48 sm:flex-shrink-0">
          <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible bg-[#111518]/80 backdrop-blur-xl rounded-xl border border-white/[0.06] p-2 sm:space-y-1" style={{ scrollbarWidth: "none" }}>
            <p className="hidden sm:block text-[10px] font-semibold text-neutral-500 uppercase px-2 py-1.5">Canales</p>
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.id)}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px] whitespace-nowrap flex-shrink-0",
                  currentChannel === ch.id
                    ? "bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/20"
                    : "text-neutral-400 hover:bg-white/[0.03] border border-transparent"
                )}
              >
                <span className="text-base">{ch.icon}</span>
                {ch.name}
              </button>
            ))}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-[#0d0f12]/60 backdrop-blur-xl rounded-xl border border-white/[0.06] p-4 space-y-2">
            {isLoading ? (
              <div className="py-8 flex items-center justify-center text-neutral-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : messages.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-sm">Sin mensajes. ¡Escribe el primero!</div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.2) }}
                    className={cn(
                      "flex gap-2.5 p-2.5 rounded-lg",
                      msg.priority === "urgent" && "bg-yellow-500/5 border border-yellow-500/15",
                      msg.priority === "alert" && "bg-red-500/5 border border-red-500/15",
                      msg.priority === "normal" && "hover:bg-white/[0.02]",
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] text-[#0a0a0a] flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {msg.user_name?.slice(0, 1).toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#f5f5f0]">{msg.user_name}</span>
                        <span className="text-[10px] text-neutral-600">
                          {new Date(msg.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {msg.priority === "urgent" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-bold uppercase flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />Urgente</span>}
                        {msg.priority === "alert" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-bold uppercase flex items-center gap-0.5"><Bell className="w-2.5 h-2.5" />Alerta</span>}
                      </div>
                      <p className="text-sm text-neutral-300 mt-0.5">{msg.content}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick messages */}
          <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
            {quickMessages.map((qm, i) => (
              <button
                key={i}
                onClick={() => sendMut.mutate(qm)}
                disabled={sendMut.isPending || !currentChannel}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#1a1f24] border border-white/[0.06] text-neutral-400 hover:text-[#f5f5f0] hover:border-[#C5A059]/20 transition-colors disabled:opacity-50"
              >
                {qm}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div className="bg-[#111518]/80 backdrop-blur-xl rounded-xl border border-white/[0.06] p-2.5 flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[
                { id: "normal", label: "Normal", cls: "text-neutral-400" },
                { id: "urgent", label: "Urgente", cls: "text-yellow-400" },
                { id: "alert", label: "Alerta", cls: "text-red-400" },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPriority(p.id as any)}
                  className={cn(
                    "text-[10px] px-2 py-1 rounded-md font-medium transition-colors",
                    priority === p.id ? `bg-white/[0.06] ${p.cls}` : "text-neutral-600 hover:text-neutral-400"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && message.trim()) sendMut.mutate(message.trim()); }}
              placeholder={`Escribe a #${channels.find(c => c.id === currentChannel)?.name || "canal"}...`}
              className="flex-1 bg-transparent border-none text-[#f5f5f0] placeholder:text-neutral-600 focus-visible:ring-0 text-sm"
            />
            <Button
              size="sm"
              className="bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] h-9 w-9 p-0"
              onClick={() => message.trim() && sendMut.mutate(message.trim())}
              disabled={sendMut.isPending || !message.trim()}
            >
              {sendMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
