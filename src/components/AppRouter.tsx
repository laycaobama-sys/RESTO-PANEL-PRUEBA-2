"use client";

import dynamic from "next/dynamic";
import { LoadingScreen } from "@/components/LoadingScreen";

// Both screens rely on Radix UI components (Tabs, Dialog, etc.) which call
// React's useId(). When SSR'd, the IDs generated on the server can diverge
// from the IDs generated on the client during hydration, producing
// "A tree hydrated but some attributes didn't match" errors.
//
// Loading these shells with ssr:false means the server only emits a
// LoadingScreen placeholder, and the full interactive UI renders on the
// client. No hydration mismatch is possible.
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

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
}

export function AppRouter({ user }: { user: AppUser | null }) {
  if (!user) return <AuthScreen />;
  return <DashboardShell user={user} />;
}
