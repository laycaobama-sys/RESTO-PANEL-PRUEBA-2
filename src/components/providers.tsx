"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 60 * 1000,
            // No refetchInterval global — evita polling infinito
          },
        },
      })
  );
  return (
    <SessionProvider
      // No polling de sesión — evita peticiones infinitas que crashean el preview
      refetchOnWindowFocus={false}
      refetchInterval={0}
    >
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
