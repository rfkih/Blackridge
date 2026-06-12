'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { NavigationProgressBar } from '@/components/layout/NavigationProgressBar';
import { installGlobalErrorHandlers } from '@/lib/observability/installGlobalHandlers';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
            // NO global placeholderData. A global `(prev) => prev` carries the
            // previous key's data across ANY key change — switching the active
            // account would keep rendering the old account's positions/P&L as
            // if they were current. Paginated list queries that want smooth
            // page flips opt in locally with `placeholderData: keepPreviousData`.
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {}
      <Suspense fallback={null}>
        <NavigationProgressBar />
      </Suspense>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
