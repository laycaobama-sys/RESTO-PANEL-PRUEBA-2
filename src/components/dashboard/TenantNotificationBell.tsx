"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bell, Check, X, AlertTriangle, Info, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TenantNotification {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
  action_url: string | null;
}

export function TenantNotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<{ notifications: TenantNotification[]; unreadCount: number }>({
    queryKey: ['tenant-notifications'],
    queryFn: () => api('/api/notifications?limit=30'),
    refetchInterval: 15000,
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const markReadMut = useMutation({
    mutationFn: (id: string) => api(`/api/notifications/${id}`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-notifications'] }),
  });

  const markAllReadMut = useMutation({
    mutationFn: () => api('/api/notifications/mark-all-read', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-notifications'] }),
  });

  const notifications = data?.notifications || [];
  const unread = data?.unreadCount || 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-neutral-400 hover:bg-white/[0.03] hover:text-[#f5f5f0] rounded-md transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 bg-[#C5A059] text-[#0a0a0a] text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#0d0f12]"
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-[#111518] border border-white/[0.06] rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between p-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#f5f5f0]">Notificaciones</h3>
                {unread > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#C5A059]/15 text-[#C5A059]">{unread} sin leer</span>
                )}
              </div>
              {unread > 0 && (
                <button onClick={() => markAllReadMut.mutate()} disabled={markAllReadMut.isPending} className="text-[11px] text-[#C5A059] hover:underline flex items-center gap-1">
                  {markAllReadMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Marcar todas
                </button>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {isLoading ? (
                <div className="py-8 flex items-center justify-center text-neutral-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No tienes notificaciones</p>
                </div>
              ) : (
                notifications.map((n, i) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={cn(
                      'flex items-start gap-2.5 p-3 border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors group',
                      !n.read_at && 'bg-[#C5A059]/5'
                    )}
                  >
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                      n.severity === 'error' ? 'bg-red-500/15 text-red-400' :
                      n.severity === 'warning' ? 'bg-yellow-500/15 text-yellow-400' :
                      n.severity === 'success' ? 'bg-green-500/15 text-green-400' :
                      'bg-blue-500/15 text-blue-400'
                    )}>
                      {n.severity === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
                       n.severity === 'warning' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                       n.severity === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                       <Info className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-[#f5f5f0] truncate">{n.title}</p>
                        <span className="text-[10px] text-neutral-500 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.03] text-neutral-500 uppercase">{n.type.replace(/_/g, ' ')}</span>
                        {!n.read_at && (
                          <button onClick={() => markReadMut.mutate(n.id)} className="text-[10px] text-[#C5A059] hover:underline opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Marcar leída
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'ahora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const days = Math.floor(h / 24);
  return `hace ${days}d`;
}
