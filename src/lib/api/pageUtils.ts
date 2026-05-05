import type { PageResponse } from '@/types/api';

/**
 * Some list endpoints emit either a bare array or the Spring Page envelope
 * depending on filter shape. This unwraps to {@code T[]} for either form.
 */
export function extractList<T>(data: T[] | PageResponse<T>): T[] {
  if (Array.isArray(data)) return data;
  return (data as PageResponse<T>).content ?? [];
}
