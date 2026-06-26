"use client";

import dynamic from "next/dynamic";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useSession, signOut } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

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

/**
 * Decides which screen to render based on the *client-side* session state.
 *
 * The server passes an initial `user` (from getServerSession) so the very
 * first paint matches what the browser expects (no flash of login screen
 * for authenticated users). After hydration, we rely on `useSession` from
 * next-auth/react to keep the UI in sync with the actual session cookie.
 *
 * If the session expires or the user logs out, useSession fires `loading`
 * then returns `null`, and we automatically swap back to the AuthScreen
 * without any manual router.push or window.location manipulation.
 */
export function AppRouter({ user: initialUser }: { user: AppUser | null }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Keep `user` in sync with the client session. While the session is
  // loading we use the server-provided value to avoid a flash.
  const user =
    status === "loading"
      ? initialUser
      : session?.user
      ? {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
          restaurantId: session.user.restaurantId,
          restaurantName: session.user.restaurantName,
          restaurantSlug: session.user.restaurantSlug,
        }
      : null;

  // If session became unauthenticated but we still show the dashboard,
  // force a refresh so the server component re-runs getServerSession.
  // This avoids stale state when cookies expire mid-session.
  useEffect(() => {
    if (status === "unauthenticated" && initialUser) {
      router.refresh();
    }
  }, [status, initialUser, router]);

  if (status === "loading" && !initialUser) return <LoadingScreen />;
  if (!user) return <AuthScreen />;
  return <DashboardShell user={user} />;
}
