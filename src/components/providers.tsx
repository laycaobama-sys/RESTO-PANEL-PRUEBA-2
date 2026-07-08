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
            staleTime: 30 * 1000,
          },
        },
      })
  );
  return (
    <SessionProvider
      // Poll every 60s instead of on every focus. Reduces unnecessary
      // fetches that can trigger CLIENT_FETCH_ERROR during dev recompiles.
      refetchInterval={60 * 1000}
      // Don't refetch on window focus in dev — this is the #1 cause of
      // CLIENT_FETCH_ERROR because the dev server returns HTML (not JSON)
      // while recompiling.
      refetchOnWindowFocus={false}
    >
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
