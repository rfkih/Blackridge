'use client';

import { useEffect, useState } from 'react';

/**
 * Search-with-pagination state shared across the admin lists (alerts,
 * errors, research log). Debounces the user's search input, then resets
 * the page back to 0 on each new term so they don't land on an empty
 * page-7 of an unrelated filter. Other filters that need the same reset
 * call {@code setPage(0)} directly in their onChange.
 */
export function useDebouncedSearchPage(debounceMs = 400) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(0);
    }, debounceMs);
    return () => clearTimeout(t);
  }, [searchInput, debounceMs]);

  return { searchInput, setSearchInput, debouncedSearch, page, setPage };
}
