'use client';

// Client-side providers (TanStack Query, top-level navigation progress, toasts).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { NavigationProgressBar } from '@/components/layout/NavigationProgressBar';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
            // Keep the previous page's data visible while the new page is
            // fetching — this is the single biggest lever for smooth route
            // transitions. Without it, every useQuery flash-blanks its card.
            placeholderData: (previous: unknown) => previous,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* NavigationProgressBar reads useSearchParams, which Next requires to
          live under a <Suspense> boundary in the App Router. */}
      <Suspense fallback={null}>
        <NavigationProgressBar />
      </Suspense>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
