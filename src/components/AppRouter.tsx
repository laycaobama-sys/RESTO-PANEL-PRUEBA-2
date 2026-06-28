"use client";

import dynamic from "next/dynamic";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useSession, signOut } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const AuthScreen = dynamic(
  () => import("@/components/auth/AuthScreen").then((m) => m.AuthScreen),
  { ssr: false, loading: () => <LoadingScreen /> }
);

const DashboardShell = dynamic(
  () =>
    import("@/components/dashboard/DashboardShell").then(
      (m) => m.DashboardShell
    ),
  { ssr: false, loading: () => <LoadingScreen /> }
);

const SuperAdminShell = dynamic(
  () =>
    import("@/components/admin/SuperAdminShell").then((m) => m.SuperAdminShell),
  { ssr: false, loading: () => <LoadingScreen /> }
);

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "STAFF";
  isSuperAdmin: boolean;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  impersonatingOrgId: string | null;
  impersonatingOrgName: string | null;
}

/**
 * Decides which screen to render based on the client-side session state.
 *
 * Routing rules:
 *   - Not authenticated → AuthScreen
 *   - SUPER_ADMIN (not impersonating) → SuperAdminShell (global panel at /admin)
 *   - SUPER_ADMIN (impersonating a tenant) → DashboardShell (acts as that tenant)
 *   - ADMIN / STAFF → DashboardShell (their own tenant)
 */
export function AppRouter({ user: initialUser }: { user: AppUser | null }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const user =
    status === "loading"
      ? initialUser
      : session?.user
      ? {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
          isSuperAdmin: session.user.isSuperAdmin,
          restaurantId: session.user.restaurantId,
          restaurantName: session.user.restaurantName,
          restaurantSlug: session.user.restaurantSlug,
          organizationId: session.user.organizationId,
          organizationName: session.user.organizationName,
          organizationSlug: session.user.organizationSlug,
          impersonatingOrgId: session.user.impersonatingOrgId,
          impersonatingOrgName: session.user.impersonatingOrgName,
        }
      : null;

  useEffect(() => {
    if (status === "unauthenticated" && initialUser) {
      router.refresh();
    }
  }, [status, initialUser, router]);

  if (status === "loading" && !initialUser) return <LoadingScreen />;
  if (!user) return <AuthScreen />;

  // Super admin without impersonation → global panel
  if (user.isSuperAdmin && !user.impersonatingOrgId) {
    return <SuperAdminShell user={user} />;
  }

  // Super admin impersonating OR regular tenant user → tenant dashboard
  return <DashboardShell user={user} />;
}
