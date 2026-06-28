"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Eye, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

/**
 * Banner shown at the top of the tenant dashboard when a SUPER_ADMIN is
 * impersonating a tenant. Provides a clear visual indicator and a one-click
 * way to exit impersonation mode.
 */
export function ImpersonationBanner({
  tenantName,
  superAdminEmail,
}: {
  tenantName: string;
  superAdminEmail: string;
}) {
  const exitMut = useMutation({
    mutationFn: () => api("/api/admin/impersonate", { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Saliendo del modo cliente...");
      setTimeout(() => window.location.reload(), 600);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-gradient-to-r from-purple-700 to-purple-900 text-white px-4 py-2.5 flex items-center justify-between gap-3 sticky top-0 z-50 shadow-lg"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <Eye className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            Modo cliente · viendo como <strong>{tenantName}</strong>
          </p>
          <p className="text-xs text-purple-200 truncate">
            Conectado como super admin: {superAdminEmail} · Todas tus acciones quedan registradas
          </p>
        </div>
      </div>
      <button
        onClick={() => exitMut.mutate()}
        disabled={exitMut.isPending}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-purple-900 rounded-lg text-xs font-semibold hover:bg-purple-50 transition-colors flex-shrink-0"
      >
        {exitMut.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <X className="w-3.5 h-3.5" />
        )}
        Salir del modo cliente
      </button>
    </motion.div>
  );
}
