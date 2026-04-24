'use client';

import { useMutation } from '@tanstack/react-query';
import { updateMyProfile, type UpdateProfilePayload } from '@/lib/api/users';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types/api';

/**
 * Saves partial profile changes via `PATCH /api/v1/users/me`. On success,
 * replaces the user in the auth store so sidebar initials, display name, etc.
 * pick up the new value immediately without a refetch.
 */
export function useUpdateMyProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation<User, Error, UpdateProfilePayload>({
    mutationFn: (payload) => updateMyProfile(payload),
    onSuccess: (user) => {
      setUser(user);
    },
  });
}
