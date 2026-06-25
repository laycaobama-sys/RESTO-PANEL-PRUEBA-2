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

interface DashboardShellProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "STAFF";
    restaurantId: string;
    restaurantName: string;
    restaurantSlug: string;
  };
}

export function DashboardShell({ user }: DashboardShellProps) {
  const section = useAppStore((s) => s.section);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  return (
    <div className="min-h-screen bg-[#f6f6f7] flex">
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
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
  );
}

export type { Section };
