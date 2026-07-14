"use client";

import { useAppStore, type Section } from "@/lib/store";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Grid3x3,
  ChefHat,
  BookOpen,
  BarChart3,
  CalendarCheck,
  Settings,
  UtensilsCrossed,
  ExternalLink,
  X,
  HelpCircle,
  Globe,
  Users,
  MessageCircle,
  CreditCard,
  TrendingUp,
  Clock,
  Gift,
  Zap,
  Package,
  Truck,
  ShoppingCart,
  Calendar,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  id: Section;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: string;
  shortcut?: number;
}

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Principal", shortcut: 1 },
  { id: "executive", label: "Panel ejecutivo", icon: TrendingUp, group: "Principal" },
  { id: "orders", label: "Pedidos", icon: ClipboardList, group: "Operaciones", shortcut: 2 },
  { id: "tables", label: "Mesas", icon: Grid3x3, group: "Operaciones", shortcut: 3 },
  { id: "kitchen", label: "Cocina", icon: ChefHat, group: "Operaciones", shortcut: 4 },
  { id: "reservations", label: "Reservas", icon: CalendarCheck, group: "Operaciones", shortcut: 5 },
  { id: "waitlist", label: "Lista de espera", icon: Clock, group: "Operaciones" },
  { id: "menus", label: "Menús / Carta", icon: BookOpen, group: "Gestión", shortcut: 6 },
  { id: "customers", label: "Clientes (CRM)", icon: Users, group: "Gestión", shortcut: 7 },
  { id: "loyalty", label: "Fidelización", icon: Gift, group: "Gestión" },
  { id: "automations", label: "Automatizaciones", icon: Zap, group: "Gestión" },
  { id: "analytics", label: "Analíticas", icon: BarChart3, group: "Gestión", shortcut: 8 },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, group: "Sistema" },
  { id: "billing", label: "Facturación", icon: CreditCard, group: "Sistema" },
  { id: "inventory", label: "Inventario", icon: Package, group: "Operaciones" },
  { id: "suppliers", label: "Proveedores", icon: Truck, group: "Operaciones" },
  { id: "purchases", label: "Compras", icon: ShoppingCart, group: "Operaciones" },
  { id: "staff", label: "Personal", icon: UserCheck, group: "Operaciones" },
  { id: "schedule", label: "Turnos", icon: Calendar, group: "Operaciones" },
  { id: "settings", label: "Ajustes", icon: Settings, group: "Sistema", shortcut: 9 },
];

interface SidebarProps {
  restaurantName: string;
  restaurantSlug: string;
  userName: string;
  userEmail: string;
  userRole: "ADMIN" | "STAFF" | "SUPER_ADMIN";
}

export function Sidebar({
  restaurantName,
  restaurantSlug,
  userName,
  userEmail,
  userRole,
}: SidebarProps) {
  const { section, setSection, sidebarOpen, setSidebarOpen } = useAppStore();
  const groups = Array.from(new Set(NAV.map((n) => n.group)));
  const publicUrl = `/api/public/${restaurantSlug}`;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) {
          const item = NAV.find((n) => n.shortcut === num);
          if (item) { e.preventDefault(); setSection(item.id); }
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [setSection]);

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={cn(
        "fixed lg:sticky top-0 left-0 z-50 lg:z-30 h-screen w-[260px] bg-[#0d0f12] border-r border-white/[0.06] flex flex-col transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="px-5 h-16 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] flex items-center justify-center text-[#0a0a0a]">
              <UtensilsCrossed className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-tight text-[#f5f5f0] leading-none">Resto<span className="text-[#C5A059]">Panel</span></p>
              <p className="text-[11px] text-neutral-500 mt-0.5 leading-none">{userRole === "ADMIN" ? "Cuenta Admin" : userRole === "SUPER_ADMIN" ? "Super Admin" : "Cuenta Staff"}</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-neutral-500 hover:text-[#f5f5f0]"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-3 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#C5A059]/5 border border-[#C5A059]/15">
            <div className="w-8 h-8 rounded-md bg-[#C5A059]/10 flex items-center justify-center text-[#C5A059]"><ChefHat className="w-4 h-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#f5f5f0] truncate">{restaurantName}</p>
              <p className="text-[11px] text-neutral-500 truncate">/{restaurantSlug}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {groups.map((group) => (
            <div key={group} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-1">{group}</p>
              {NAV.filter((n) => n.group === group).map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button key={item.id} onClick={() => setSection(item.id)} aria-label={item.label} aria-current={active ? "page" : undefined}
                    title={item.shortcut ? `${item.label} (Alt+${item.shortcut})` : item.label}
                    className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative min-h-[44px]",
                      active ? "bg-[#C5A059]/10 text-[#C5A059]" : "text-neutral-400 hover:bg-white/[0.03] hover:text-[#f5f5f0]")}>
                    <Icon className="w-4.5 h-4.5" />
                    <span>{item.label}</span>
                    {item.shortcut && <kbd className="ml-auto text-[9px] text-neutral-600 font-mono hidden lg:inline">⌥{item.shortcut}</kbd>}
                    {active && <motion.div layoutId="sidebar-active" className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#C5A059] rounded-r-full" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="space-y-1 pt-2 border-t border-white/[0.06]">
            <p className="px-3 text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-1">Otros</p>
            <button onClick={() => setSection("public")} className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]", section === "public" ? "bg-[#C5A059]/10 text-[#C5A059]" : "text-neutral-400 hover:bg-white/[0.03] hover:text-[#f5f5f0]")}>
              <ExternalLink className="w-4.5 h-4.5" /><span>Ver carta pública</span>
            </button>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:bg-white/[0.03] hover:text-[#f5f5f0] min-h-[44px]">
              <HelpCircle className="w-4.5 h-4.5" /><span>Abrir API pública</span>
            </a>
            <a href="/landing" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:bg-white/[0.03] hover:text-[#f5f5f0] min-h-[44px]">
              <Globe className="w-4.5 h-4.5" /><span>Ver landing pública</span>
            </a>
          </div>
        </nav>

        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C5A059] to-[#9a7d3e] text-[#0a0a0a] flex items-center justify-center text-sm font-semibold">{userName.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#f5f5f0] truncate">{userName}</p>
              <p className="text-xs text-neutral-500 truncate">{userEmail}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
