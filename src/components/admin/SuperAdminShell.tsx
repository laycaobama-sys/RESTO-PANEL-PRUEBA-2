"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  UtensilsCrossed,
  LayoutDashboard,
  Building2,
  Users,
  ScrollText,
  LogOut,
  Bell,
  Menu as MenuIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SuperAdminDashboard } from "./sections/SuperAdminDashboard";
import { TenantsSection } from "./sections/TenantsSection";
import { UsersSection } from "./sections/UsersSection";
import { AuditLogsSection } from "./sections/AuditLogsSection";
import { NotificationBell } from "./NotificationBell";
import { GlobalSearch } from "./GlobalSearch";

type Section = "dashboard" | "tenants" | "users" | "logs";

interface SuperAdminShellProps {
  user: {
    id: string;
    name: string;
    email: string;
    isSuperAdmin: boolean;
  };
}

const NAV: { id: Section; label: string; icon: any }[] = [
  { id: "dashboard", label: "Resumen global", icon: LayoutDashboard },
  { id: "tenants", label: "Empresas", icon: Building2 },
  { id: "users", label: "Usuarios", icon: Users },
  { id: "logs", label: "Auditoría", icon: ScrollText },
];

export function SuperAdminShell({ user }: SuperAdminShellProps) {
  const [section, setSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false); // closed by default; mobile opens via hamburger, desktop is always visible via CSS

  return (
    <div className="min-h-screen bg-[#0f0f12] text-white">
      {/* Sidebar (desktop) + drawer (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          "w-[260px] bg-[#16161a] border-r border-[#27272a] flex flex-col fixed h-screen z-50 transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="px-5 h-16 flex items-center justify-between border-b border-[#27272a]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#F94B1E] flex items-center justify-center text-white">
              <UtensilsCrossed className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-tight leading-none">RestoPanel</p>
              <p className="text-[11px] text-[#FF6B35] mt-0.5 leading-none font-medium">SUPER ADMIN · HQ</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="px-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Control global</p>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setSection(item.id); setSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]",
                  active ? "bg-[#FF6B35]/15 text-[#FF6B35]" : "text-neutral-400 hover:bg-[#1f1f23] hover:text-white"
                )}
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[#27272a] p-3">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#F94B1E] text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-neutral-500 truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-neutral-400 hover:text-white hover:bg-[#1f1f23] min-h-[40px]"
            onClick={async () => {
              toast.success("Cerrando sesión...");
              await signOut({ redirect: false, callbackUrl: "/" });
              setTimeout(() => window.location.reload(), 150);
            }}
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-[260px] flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-[#16161a]/85 backdrop-blur-md border-b border-[#27272a] h-16 flex items-center px-3 sm:px-6 gap-2 sm:gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-neutral-400 hover:text-white hover:bg-[#1f1f23] rounded-md flex-shrink-0"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <h1 className="text-sm sm:text-base font-semibold flex-shrink-0">
            <span className="hidden sm:inline">{NAV.find((n) => n.id === section)?.label}</span>
            <span className="sm:hidden">Admin</span>
          </h1>
          <div className="flex-1 max-w-md mx-auto sm:mx-0">
            <GlobalSearch />
          </div>
          <NotificationBell />
        </header>

        {/* Main */}
        <main className="flex-1 p-3 sm:p-5 lg:p-7">
          {section === "dashboard" && <SuperAdminDashboard />}
          {section === "tenants" && <TenantsSection />}
          {section === "users" && <UsersSection />}
          {section === "logs" && <AuditLogsSection />}
        </main>
      </div>
    </div>
  );
}
