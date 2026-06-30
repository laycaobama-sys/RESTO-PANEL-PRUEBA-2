"use client";

import { useAppStore, type Section } from "@/lib/store";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { DashboardSection } from "./sections/DashboardSection";
import { OrdersSection } from "./sections/OrdersSection";
import { TablesSection } from "./sections/TablesSection";
import { KitchenSection } from "./sections/KitchenSection";
import { MenusSection } from "./sections/MenusSection";
import { AnalyticsSection } from "./sections/AnalyticsSection";
import { ReservationsSection } from "./sections/ReservationsSection";
import { SettingsSection } from "./sections/SettingsSection";
import { PublicMenuSection } from "./sections/PublicMenuSection";
import { MenuMobile } from "./MenuMobile";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";

interface DashboardShellProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: "SUPER_ADMIN" | "ADMIN" | "STAFF";
    isSuperAdmin?: boolean;
    restaurantId: string;
    restaurantName: string;
    restaurantSlug: string;
    impersonatingOrgId?: string | null;
    impersonatingOrgName?: string | null;
  };
}

export function DashboardShell({ user }: DashboardShellProps) {
  const section = useAppStore((s) => s.section);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {user.isSuperAdmin && user.impersonatingOrgId && (
        <ImpersonationBanner
          tenantName={user.impersonatingOrgName || ""}
          superAdminEmail={user.email}
        />
      )}
      <div className="flex flex-1">
        <Sidebar
          restaurantName={user.restaurantName}
          restaurantSlug={user.restaurantSlug}
          userName={user.name}
          userEmail={user.email}
          userRole={user.role}
        />
        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar user={user} />
          <MenuMobile restaurantName={user.restaurantName} />
          <main className="flex-1 p-3 sm:p-5 lg:p-7">
            {section === "dashboard" && <DashboardSection />}
            {section === "orders" && <OrdersSection />}
            {section === "tables" && <TablesSection />}
            {section === "kitchen" && <KitchenSection />}
            {section === "menus" && <MenusSection />}
            {section === "analytics" && <AnalyticsSection />}
            {section === "reservations" && <ReservationsSection />}
            {section === "settings" && <SettingsSection />}
            {section === "public" && <PublicMenuSection slug={user.restaurantSlug} />}
          </main>
        </div>
      </div>
    </div>
  );
}

export type { Section };
