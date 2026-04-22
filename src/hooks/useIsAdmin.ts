'use client';

import { useAuthStore } from '@/store/authStore';

/**
 * True iff the authenticated user has the ADMIN role.
 *
 * <p>The backend stores role as a plain string on `users.role` and exposes
 * it on the `/me` response. Role names are case-insensitive here so we
 * don't care whether the backend sends `ADMIN`, `admin`, or `Role_Admin`.
 *
 * <p>This hook is a selector-only read — no re-renders when unrelated auth
 * state changes.
 */
export function useIsAdmin(): boolean {
  return useAuthStore((s) => {
    const role = s.user?.role;
    if (!role) return false;
    return role.toUpperCase().replace(/^ROLE_/, '') === 'ADMIN';
  });
}
