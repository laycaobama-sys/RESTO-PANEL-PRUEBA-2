"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, Loader2, Lock, Mail, Crown, AlertCircle, CheckCircle2 } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("La contraseña debe tener al menos 12 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al crear el super-admin");
        return;
      }

      setSuccess(true);
      // Redirigir al login tras 3 segundos
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-green-500/15 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">¡Super-Admin creado!</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Tu cuenta de super-administrador está lista. Redirigiéndote al login...
          </p>
          <Loader2 className="w-5 h-5 animate-spin text-[#C5A059] mx-auto" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#C5A059]/15 flex items-center justify-center">
            <Crown className="w-8 h-8 text-[#C5A059]" />
          </div>
          <h1 className="text-2xl font-bold text-white">Configuración inicial</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Crea tu cuenta de Super-Admin. Solo tú tendrás acceso.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 bg-[#111518] rounded-2xl border border-white/[0.06] p-6">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">Email del Super-Admin</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-[#C5A059]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">
              Contraseña <span className="text-neutral-600">(mín. 12 caracteres)</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-[#C5A059]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">Confirmar contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-[#C5A059]"
              />
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/15 text-yellow-400 text-xs">
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Esta página solo funciona <strong>una vez</strong>. Después de crear el super-admin,
              quedará deshabilitada permanentemente. Guarda tus credenciales en un lugar seguro.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password || !confirmPassword}
            className="w-full h-11 rounded-lg bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</>
            ) : (
              <><Crown className="w-4 h-4" /> Crear Super-Admin</>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-neutral-600 mt-4">
          🔒 Esta cuenta tendrá acceso total al panel de administración
        </p>
      </motion.div>
    </div>
  );
}
