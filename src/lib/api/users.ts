import { apiClient } from './client';
import type { BackendUser, User } from '@/types/api';

/**
 * Payload matching the Java DTO {@code UpdateProfileRequest}. Backend treats
 * each field as optional — only provided keys are updated on the row.
 */
export interface UpdateProfilePayload {
  fullName?: string;
  phoneNumber?: string;
}

function mapUser(u: BackendUser): User {
  return {
    id: u.userId,
    email: u.email,
    name: u.fullName,
    role: u.role,
    createdAt: u.createdTime,
  };
}

export async function updateMyProfile(payload: UpdateProfilePayload): Promise<User> {
  const { data } = await apiClient.patch<BackendUser>('/api/v1/users/me', payload);
  return mapUser(data);
}
