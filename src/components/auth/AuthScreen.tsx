"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  UtensilsCrossed,
  Mail,
  Lock,
  User as UserIcon,
  Store,
  Phone,
  MapPin,
  Loader2,
  ArrowRight,
  ChefHat,
  Clock,
  TrendingUp,
  Globe,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";

type View = "auth" | "forgot" | "reset";

export function AuthScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<null | "login" | "register" | "forgot" | "reset">(null);
  const [view, setView] = useState<View>("auth");

  const [loginEmail, setLoginEmail] = useState("demo@lazamorana.es");
  const [loginPassword, setLoginPassword] = useState("demo1234");

  const [reg, setReg] = useState({
    name: "",
    email: "",
    password: "",
    restaurantName: "",
    phone: "",
    address: "",
    city: "",
    country: "España",
  });

  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  const isPrivateMode = process.env.NEXT_PUBLIC_LAUNCH_MODE === "private";
  const allowRegistration = !isPrivateMode;

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading("login");
    try {
      const res = await signIn("credentials", {
        email: loginEmail.toLowerCase().trim(),
        password: loginPassword,
        redirect: false,
      });
      if (!res || res.error) {
        toast.error("Credenciales incorrectas. Revisa tu email y contraseña.");
        setLoading(null);
        return;
      }
      toast.success("¡Bienvenido de nuevo!");
      window.location.reload();
    } catch {
      toast.error("Error al iniciar sesión");
      setLoading(null);
    }
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    if (reg.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading("register");
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(reg),
      });
      const res = await signIn("credentials", {
        email: reg.email.toLowerCase().trim(),
        password: reg.password,
        redirect: false,
      });
      if (!res || res.error) {
        toast.success("Cuenta creada. Inicia sesión con tus credenciales.");
      } else {
        toast.success("¡Cuenta creada! Bienvenido a RestoPanel");
        window.location.reload();
      }
    } catch (err: any) {
      toast.error(err.message || "Error al crear la cuenta");
    } finally {
      setLoading(null);
    }
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading("forgot");
    try {
      const res = await api<{ resetToken?: string; message: string }>(
        "/api/auth/forgot-password",
        { method: "POST", body: JSON.stringify({ email: forgotEmail }) }
      );
      if (res.resetToken) {
        setResetToken(res.resetToken);
        toast.info("Te hemos enviado un enlace de recuperación (modo demo).");
        setView("reset");
      } else {
        toast.success("Si el email existe, recibirás un enlace de recuperación.");
        setView("auth");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al solicitar el reseteo");
    } finally {
      setLoading(null);
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    if (resetPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading("reset");
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: resetToken, password: resetPassword }),
      });
      toast.success("Contraseña actualizada. Ya puedes iniciar sesión.");
      setView("auth");
      setLoginEmail(forgotEmail);
      setResetToken("");
      setResetPassword("");
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar la contraseña");
    } finally {
      setLoading(null);
    }
  }

  if (view === "forgot") {
    return (
      <AuthLayout>
        <form onSubmit={onForgot} className="space-y-4">
          <button type="button" onClick={() => setView("auth")} className="flex items-center gap-1 text-sm text-neutral-400 hover:text-[#C5A059] mb-2">
            <ArrowLeft className="w-4 h-4" /> Volver a iniciar sesión
          </button>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold text-[#f5f5f0] tracking-tight">Recuperar contraseña</h2>
            <p className="text-sm text-neutral-400">Introduce tu email y te enviaremos un enlace para restablecerla.</p>
          </div>
          <Field icon={<Mail className="w-4 h-4" />} label="Email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="tu@restaurante.com" required />
          <Button type="submit" className="w-full bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] h-11 font-semibold" disabled={loading === "forgot"}>
            {loading === "forgot" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar enlace de recuperación"}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  if (view === "reset") {
    return (
      <AuthLayout>
        <form onSubmit={onReset} className="space-y-4">
          <button type="button" onClick={() => setView("auth")} className="flex items-center gap-1 text-sm text-neutral-400 hover:text-[#C5A059] mb-2">
            <ArrowLeft className="w-4 h-4" /> Volver a iniciar sesión
          </button>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold text-[#f5f5f0] tracking-tight">Nueva contraseña</h2>
            <p className="text-sm text-neutral-400">Introduce tu nueva contraseña (mínimo 6 caracteres).</p>
          </div>
          <Field icon={<Lock className="w-4 h-4" />} label="Token de recuperación" value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="Enlace enviado por email" required />
          <Field icon={<Lock className="w-4 h-4" />} label="Nueva contraseña" type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="••••••••" required />
          <Button type="submit" className="w-full bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] h-11 font-semibold" disabled={loading === "reset"}>
            {loading === "reset" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Actualizar contraseña"}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-[#0a0a0a]">
      {/* Left: hero / brand (dark premium) */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#0d1410] to-[#0a0a0a]">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full bg-[#004D40] blur-[120px]" />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 rounded-full bg-[#C5A059]/20 blur-[120px]" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] flex items-center justify-center text-[#0a0a0a]">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-[#f5f5f0]">Resto<span className="text-[#C5A059]">Panel</span></span>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-[#f5f5f0]">
              Llena más mesas.
              <br />
              Pierde menos reservas.
              <br />
              <span className="text-[#C5A059]">Conoce a cada cliente.</span>
            </h1>
            <p className="text-neutral-400 text-lg max-w-md leading-relaxed">
              El panel de control que tu restaurante necesita. Reservas, mesas, CRM y analítica en una sola plataforma.
            </p>
          </div>
          <div className="space-y-4 max-w-md">
            <Feature icon={<ChefHat className="w-4 h-4" />} title="Carta digital en tiempo real" desc="Cambia precios, fotos y descripciones; se actualizan en tu web sin tocar código." />
            <Feature icon={<Clock className="w-4 h-4" />} title="Cocina y POS integrado" desc="Pedidos, mesas y KDS conectados para que nada se pierda en horas punta." />
            <Feature icon={<TrendingUp className="w-4 h-4" />} title="Analíticas que importan" desc="Ventas, ticket medio y platos estrella en gráficas claras." />
          </div>
        </div>

        <div className="relative z-10 text-sm text-neutral-500">© {new Date().getFullYear()} RestoPanel · Hecho para restauradores</div>
      </div>

      {/* Right: auth forms */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-12 bg-[#0a0a0a]">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] flex items-center justify-center text-[#0a0a0a]">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-[#f5f5f0]">Resto<span className="text-[#C5A059]">Panel</span></span>
          </div>

          <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-6 sm:p-8">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className={`bg-[#1a1f24] mb-6 ${allowRegistration ? "grid grid-cols-2 w-full" : "grid-cols-1 w-full"}`}>
                <TabsTrigger value="login" className="data-[state=active]:bg-[#C5A059] data-[state=active]:text-[#0a0a0a] data-[state=active]:shadow-sm text-neutral-400">
                  Iniciar sesión
                </TabsTrigger>
                {allowRegistration && (
                  <TabsTrigger value="register" className="data-[state=active]:bg-[#C5A059] data-[state=active]:text-[#0a0a0a] data-[state=active]:shadow-sm text-neutral-400">
                    Crear cuenta
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={onLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <h2 className="text-2xl font-semibold text-[#f5f5f0] tracking-tight">Bienvenido de nuevo</h2>
                    <p className="text-sm text-neutral-400">Accede a tu panel de gestión</p>
                  </div>
                  <Field icon={<Mail className="w-4 h-4" />} label="Email" type="email" autoComplete="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="tu@restaurante.com" required />
                  <Field icon={<Lock className="w-4 h-4" />} label="Contraseña" type="password" autoComplete="current-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" required />
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 text-neutral-400 cursor-pointer">
                      <input type="checkbox" className="accent-[#C5A059] w-3.5 h-3.5" defaultChecked />
                      Recordarme
                    </label>
                    <button type="button" onClick={() => { setForgotEmail(loginEmail); setView("forgot"); }} className="text-[#C5A059] hover:underline font-medium">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <Button type="submit" className="w-full bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] h-11 font-semibold" disabled={loading === "login"}>
                    {loading === "login" ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Acceder al panel<ArrowRight className="w-4 h-4 ml-1" /></>)}
                  </Button>

                  <div className="rounded-lg bg-[#C5A059]/5 border border-[#C5A059]/15 p-3 text-xs text-neutral-400">
                    <p className="font-semibold mb-1 text-[#C5A059]">{isPrivateMode ? "🔒 Modo pre-lanzamiento (privado)" : "Cuentas demo"}</p>
                    {isPrivateMode && <p className="mb-1">El registro público está desactivado. Solo cuentas autorizadas pueden acceder.</p>}
                    <p className="font-mono">demo@lazamorana.es · demo1234</p>
                    <p className="font-mono">demo@bistrodelpuerto.es · demo1234</p>
                    <p className="font-mono mt-1 text-[#C5A059]">owner@restopanel.es · owner2026 (SUPER ADMIN)</p>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={onRegister} className="space-y-3.5">
                  <div className="space-y-1.5 mb-2">
                    <h2 className="text-2xl font-semibold text-[#f5f5f0] tracking-tight">Crea tu cuenta</h2>
                    <p className="text-sm text-neutral-400">Empieza a gestionar tu restaurante en minutos</p>
                  </div>
                  <Field icon={<UserIcon className="w-4 h-4" />} label="Tu nombre" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} placeholder="Carmen Zamorano" required />
                  <Field icon={<Store className="w-4 h-4" />} label="Nombre del restaurante" value={reg.restaurantName} onChange={(e) => setReg({ ...reg, restaurantName: e.target.value })} placeholder="La Zamorana" required />
                  <Field icon={<Mail className="w-4 h-4" />} label="Email" type="email" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} placeholder="tu@restaurante.com" required />
                  <Field icon={<Lock className="w-4 h-4" />} label="Contraseña (mín. 6 caracteres)" type="password" value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} placeholder="••••••••" required />
                  <div className="grid grid-cols-2 gap-3">
                    <Field icon={<Phone className="w-4 h-4" />} label="Teléfono" value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} placeholder="+34 600 000 000" />
                    <Field icon={<MapPin className="w-4 h-4" />} label="Ciudad" value={reg.city} onChange={(e) => setReg({ ...reg, city: e.target.value })} placeholder="Salamanca" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-neutral-400">País</Label>
                    <Select value={reg.country} onValueChange={(v) => setReg({ ...reg, country: v })}>
                      <SelectTrigger className="h-10 bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0]"><span className="flex items-center gap-2"><Globe className="w-4 h-4 text-neutral-500" /><SelectValue /></span></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="España">España</SelectItem>
                        <SelectItem value="México">México</SelectItem>
                        <SelectItem value="Argentina">Argentina</SelectItem>
                        <SelectItem value="Colombia">Colombia</SelectItem>
                        <SelectItem value="Chile">Chile</SelectItem>
                        <SelectItem value="Perú">Perú</SelectItem>
                        <SelectItem value="Portugal">Portugal</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full bg-[#C5A059] hover:bg-[#b08d4e] text-[#0a0a0a] h-11 font-semibold mt-2" disabled={loading === "register"}>
                    {loading === "register" ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Crear cuenta y empezar<ArrowRight className="w-4 h-4 ml-1" /></>)}
                  </Button>
                  <div className="flex items-start gap-2 text-xs text-neutral-500 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] mt-0.5 flex-shrink-0" />
                    <p>Al registrarte aceptas los términos de servicio y la política de privacidad. Tus datos quedan aislados de otros restaurantes.</p>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] flex items-center justify-center text-[#0a0a0a]">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-[#f5f5f0]">Resto<span className="text-[#C5A059]">Panel</span></span>
        </div>
        <div className="bg-[#111518] rounded-2xl border border-white/[0.06] p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-lg bg-[#C5A059]/15 text-[#C5A059] flex items-center justify-center flex-shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="font-medium text-[#f5f5f0]">{title}</p>
        <p className="text-sm text-neutral-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function Field({ icon, label, type = "text", ...props }: { icon: React.ReactNode; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-neutral-400">{label}</Label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>
        <Input type={type} className="pl-9 h-10 bg-[#1a1f24] border-white/[0.06] text-[#f5f5f0] placeholder:text-neutral-600 focus-visible:ring-[#C5A059] focus-visible:ring-offset-0 focus-visible:border-[#C5A059]" {...props} />
      </div>
    </div>
  );
}
