import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/next-auth";
import { AppRouter, type AppUser } from "@/components/AppRouter";

export default async function Page() {
  const session = await getServerSession(authOptions);
  const user: AppUser | null = session
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
  return <AppRouter user={user} />;
}
