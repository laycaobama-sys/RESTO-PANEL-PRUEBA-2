"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api";

export function AuthScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<null | "login" | "register">(null);

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
  });

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading("login");
    try {
      const res = await signIn("credentials", {
        email: loginEmail.toLowerCase(),
        password: loginPassword,
        redirect: false,
      });
      if (!res || res.error) {
        toast.error("Credenciales incorrectas. Revisa tu email y contraseña.");
        setLoading(null);
        return;
      }
      toast.success("¡Bienvenido de nuevo!");
      router.refresh();
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
        email: reg.email.toLowerCase(),
        password: reg.password,
        redirect: false,
      });
      if (!res || res.error) {
        toast.success("Cuenta creada. Inicia sesión para continuar.");
      } else {
        toast.success("¡Cuenta creada! Bienvenido a RestoPanel");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Error al crear la cuenta");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-white">
      {/* Left: hero / brand */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-[#FF6B35] via-[#F94B1E] to-[#D43A12] text-white">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-yellow-200 blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <span className="text-xl font-semibold tracking-tight">RestoPanel</span>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Tu restaurante,
              <br />
              <span className="text-white/90">controlado al detalle.</span>
            </h1>
            <p className="text-white/85 text-lg max-w-md leading-relaxed">
              Gestiona carta, pedidos, mesas y analíticas desde un único panel.
              Los cambios se sincronizan al instante con tu web pública.
            </p>
          </div>

          <div className="space-y-4 max-w-md">
            <Feature
              icon={<ChefHat className="w-4 h-4" />}
              title="Carta digital en tiempo real"
              desc="Cambia precios, fotos y descripciones; se actualizan en tu web sin tocar código."
            />
            <Feature
              icon={<Clock className="w-4 h-4" />}
              title="Cocina y POS integrado"
              desc="Pedidos, mesas y KDS conectados para que nada se pierda en horas punta."
            />
            <Feature
              icon={<TrendingUp className="w-4 h-4" />}
              title="Analíticas que importan"
              desc="Ventas, ticket medio y platos estrella en gráficas claras."
            />
          </div>
        </div>

        <div className="relative z-10 text-sm text-white/70">
          © {new Date().getFullYear()} RestoPanel · Hecho para restauradores
        </div>
      </div>

      {/* Right: auth forms */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-12 bg-[#f6f6f7]">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B35] flex items-center justify-center text-white">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-neutral-900">
              RestoPanel
            </span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-[#ececed] p-6 sm:p-8">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid grid-cols-2 w-full mb-6 bg-[#f6f6f7]">
                <TabsTrigger
                  value="login"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  Iniciar sesión
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  Crear cuenta
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={onLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">
                      Bienvenido de nuevo
                    </h2>
                    <p className="text-sm text-neutral-500">
                      Accede a tu panel de gestión
                    </p>
                  </div>
                  <Field
                    icon={<Mail className="w-4 h-4 text-neutral-400" />}
                    label="Email"
                    type="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="tu@restaurante.com"
                    required
                  />
                  <Field
                    icon={<Lock className="w-4 h-4 text-neutral-400" />}
                    label="Contraseña"
                    type="password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 text-neutral-500 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-[#FF6B35] w-3.5 h-3.5"
                        defaultChecked
                      />
                      Recordarme
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        toast.info(
                          "Recuperación de contraseña disponible en producción"
                        )
                      }
                      className="text-[#FF6B35] hover:underline font-medium"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#FF6B35] hover:bg-[#F94B1E] text-white h-11 font-medium"
                    disabled={loading === "login"}
                  >
                    {loading === "login" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Acceder al panel
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>

                  <div className="rounded-lg bg-[#FFF3ED] border border-[#FFE0CB] p-3 text-xs text-neutral-700">
                    <p className="font-semibold mb-0.5 text-[#9a3b18]">
                      Cuenta demo
                    </p>
                    <p>
                      Email:{" "}
                      <span className="font-mono">demo@lazamorana.es</span>
                    </p>
                    <p>
                      Contraseña: <span className="font-mono">demo1234</span>
                    </p>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={onRegister} className="space-y-3.5">
                  <div className="space-y-1.5 mb-2">
                    <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">
                      Crea tu cuenta
                    </h2>
                    <p className="text-sm text-neutral-500">
                      Empieza a gestionar tu restaurante en minutos
                    </p>
                  </div>
                  <Field
                    icon={<UserIcon className="w-4 h-4 text-neutral-400" />}
                    label="Tu nombre"
                    value={reg.name}
                    onChange={(e) => setReg({ ...reg, name: e.target.value })}
                    placeholder="Carmen Zamorano"
                    required
                  />
                  <Field
                    icon={<Store className="w-4 h-4 text-neutral-400" />}
                    label="Nombre del restaurante"
                    value={reg.restaurantName}
                    onChange={(e) =>
                      setReg({ ...reg, restaurantName: e.target.value })
                    }
                    placeholder="La Zamorana"
                    required
                  />
                  <Field
                    icon={<Mail className="w-4 h-4 text-neutral-400" />}
                    label="Email"
                    type="email"
                    value={reg.email}
                    onChange={(e) => setReg({ ...reg, email: e.target.value })}
                    placeholder="tu@restaurante.com"
                    required
                  />
                  <Field
                    icon={<Lock className="w-4 h-4 text-neutral-400" />}
                    label="Contraseña (mín. 6 caracteres)"
                    type="password"
                    value={reg.password}
                    onChange={(e) =>
                      setReg({ ...reg, password: e.target.value })
                    }
                    placeholder="••••••••"
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      icon={<Phone className="w-4 h-4 text-neutral-400" />}
                      label="Teléfono"
                      value={reg.phone}
                      onChange={(e) =>
                        setReg({ ...reg, phone: e.target.value })
                      }
                      placeholder="+34 600 000 000"
                    />
                    <Field
                      icon={<MapPin className="w-4 h-4 text-neutral-400" />}
                      label="Ciudad"
                      value={reg.city}
                      onChange={(e) => setReg({ ...reg, city: e.target.value })}
                      placeholder="Salamanca"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#FF6B35] hover:bg-[#F94B1E] text-white h-11 font-medium mt-2"
                    disabled={loading === "register"}
                  >
                    {loading === "register" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Crear cuenta y empezar
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-neutral-400 text-center leading-relaxed">
                    Al registrarte aceptas los términos de servicio y la política
                    de privacidad de RestoPanel.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="font-medium text-white">{title}</p>
        <p className="text-sm text-white/75 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  type = "text",
  ...props
}: {
  icon: React.ReactNode;
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-neutral-700">{label}</Label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>
        <Input
          type={type}
          className="pl-9 h-10 bg-white border-[#ececed] focus-visible:ring-[#FF6B35] focus-visible:ring-offset-0 focus-visible:border-[#FF6B35]"
          {...props}
        />
      </div>
    </div>
  );
}
