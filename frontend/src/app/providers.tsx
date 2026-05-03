import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { ToastProvider } from "@/shared/components/ui/toast";

export function Providers({ children }: { children: ReactNode }) {
  // Crear el QueryClient en useState para que sobreviva re-renders pero no
  // se comparta entre tests/SSR (cuando lleguemos a SSR).
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Datos frescos durante 30s — las listas no cambian tan rápido y
            // ahorra requests al backend (= ahorra latencia percibida).
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: (failureCount, error) => {
              // No reintentar en 4xx (errores de cliente). Sí en 5xx/red.
              const status = (error as { response?: { status?: number } })?.response?.status;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
