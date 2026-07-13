"use client";

import { useAppStore, type Section } from "@/lib/store";
import dynamic from "next/dynamic";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MenuMobile } from "./MenuMobile";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { LoadingScreen } from "@/components/LoadingScreen";

// ─── Lazy-loaded sections ─────────────────────────────────────
// Each section is loaded on demand, reducing the initial bundle
// size. The loading fallback shows a spinner while the chunk
// downloads. This improves Core Web Vitals (LCP, FID) on the
// dashboard.
const DashboardSection = dynamic(() => import("./sections/DashboardSection").then(m => m.DashboardSection), { loading: () => <LoadingScreen /> });
const ExecutiveDashboard = dynamic(() => import("./sections/ExecutiveDashboard").then(m => m.ExecutiveDashboard), { loading: () => <LoadingScreen /> });
const OrdersSection = dynamic(() => import("./sections/OrdersSection").then(m => m.OrdersSection), { loading: () => <LoadingScreen /> });
const TablesSection = dynamic(() => import("./sections/TablesSection").then(m => m.TablesSection), { loading: () => <LoadingScreen /> });
const KitchenSection = dynamic(() => import("./sections/KitchenSection").then(m => m.KitchenSection), { loading: () => <LoadingScreen /> });
const MenusSection = dynamic(() => import("./sections/MenusSection").then(m => m.MenusSection), { loading: () => <LoadingScreen /> });
const AnalyticsSection = dynamic(() => import("./sections/AnalyticsSection").then(m => m.AnalyticsSection), { loading: () => <LoadingScreen /> });
const ReservationsSection = dynamic(() => import("./sections/ReservationsSection").then(m => m.ReservationsSection), { loading: () => <LoadingScreen /> });
const WaitlistSection = dynamic(() => import("./sections/WaitlistSection").then(m => m.WaitlistSection), { loading: () => <LoadingScreen /> });
const CustomersSection = dynamic(() => import("./sections/CustomersSection").then(m => m.CustomersSection), { loading: () => <LoadingScreen /> });
const CrmSection = dynamic(() => import("./sections/CrmSection").then(m => m.CrmSection), { loading: () => <LoadingScreen /> });
const AutomationsSection = dynamic(() => import("./sections/AutomationsSection").then(m => m.AutomationsSection), { loading: () => <LoadingScreen /> });
const SettingsSection = dynamic(() => import("./sections/SettingsSection").then(m => m.SettingsSection), { loading: () => <LoadingScreen /> });
const PublicMenuSection = dynamic(() => import("./sections/PublicMenuSection").then(m => m.PublicMenuSection), { loading: () => <LoadingScreen /> });

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
            {section === "executive" && <ExecutiveDashboard />}
            {section === "orders" && <OrdersSection />}
            {section === "tables" && <TablesSection />}
            {section === "kitchen" && <KitchenSection />}
            {section === "menus" && <MenusSection />}
            {section === "analytics" && <AnalyticsSection />}
            {section === "reservations" && <ReservationsSection />}
            {section === "waitlist" && <WaitlistSection />}
            {section === "customers" && <CustomersSection />}
            {section === "loyalty" && <CrmSection />}
            {section === "automations" && <AutomationsSection />}
            {section === "settings" && <SettingsSection />}
            {section === "public" && <PublicMenuSection slug={user.restaurantSlug} />}
          </main>
        </div>
      </div>
    </div>
  );
}

export type { Section };
