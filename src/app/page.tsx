import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/next-auth";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) return <AuthScreen />;
  return <DashboardShell user={session.user} />;
}
