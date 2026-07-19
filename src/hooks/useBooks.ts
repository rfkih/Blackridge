import { useQuery } from '@tanstack/react-query';
import { getBooks, getBookTargets } from '@/lib/api/books';
import { QUERY_STALE_TIMES } from '@/lib/constants';

export function useBooks() {
  return useQuery({
    queryKey: ['equity', 'books'],
    queryFn: getBooks,
    staleTime: QUERY_STALE_TIMES.closedTrades,
  });
}

export function useBookTargets(
  bookCode: string | undefined,
  asOfDate?: string,
  version?: number,
) {
  return useQuery({
    queryKey: ['equity', 'book-targets', bookCode ?? null, asOfDate ?? null, version ?? null],
    queryFn: () => getBookTargets(bookCode as string, asOfDate, version),
    enabled: !!bookCode,
    staleTime: QUERY_STALE_TIMES.closedTrades,
  });
}
