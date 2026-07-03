import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/next-auth";
import { AuthScreen } from "@/components/auth/AuthScreen";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar sesión · RestoPanel",
  description: "Accede a tu panel de gestión de restaurante.",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  // Already logged in → go to the app
  if (session?.user) {
    redirect("/");
  }
  // Not logged in → show the auth screen
  return <AuthScreen />;
}
