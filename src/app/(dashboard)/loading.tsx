import { Skeleton } from '@/components/ui/skeleton';

/**
 * Route-group Suspense fallback: shows instantly while a dashboard page's JS
 * chunk loads during client-side navigation, instead of a frozen screen.
 * Generic by design — individual pages own their data-level skeletons.
 */
export default function DashboardRouteLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading page">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-72" />
      <Skeleton className="h-48" />
    </div>
  );
}
