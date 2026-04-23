import { PageLoader } from '@/components/shared/PageLoader';

/** Root-level fallback — shown for the first paint before the segment's own
 *  `loading.tsx` (if any) takes over. */
export default function RootLoading() {
  return <PageLoader label="Meridian Edge" />;
}
