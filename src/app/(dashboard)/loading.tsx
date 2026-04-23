import { PageLoader } from '@/components/shared/PageLoader';

/**
 * Next.js automatic loading UI for every route under `(dashboard)`.
 * Shown during navigation between dashboard pages while server data
 * is still being fetched, and on the initial route transition.
 */
export default function DashboardLoading() {
  return <PageLoader label="Loading desk" />;
}
