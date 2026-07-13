import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/next-auth";
import { AppRouter, type AppUser } from "@/components/AppRouter";

export default async function Page() {
  const session = await getServerSession(authOptions);

  // Not authenticated → send the visitor to the marketing landing page.
  // The login form lives at /login so it can be linked from CTAs.
  if (!session?.user) {
    redirect("/landing");
  }

  // Super-admin without an organization → redirect to /admin panel
  if (session.user.isSuperAdmin && !session.user.organizationId) {
    redirect("/admin");
  }

  const user: AppUser = {
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
  };

  return <AppRouter user={user} />;
}
