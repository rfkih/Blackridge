import { apiClient } from './client';

export interface PasswordResetRequestPayload {
  email: string;
}

export interface PasswordResetConfirmPayload {
  token: string;
  newPassword: string;
}

export async function requestPasswordReset(payload: PasswordResetRequestPayload): Promise<void> {
  await apiClient.post('/api/v1/users/password-reset/request', payload);
}

export async function confirmPasswordReset(payload: PasswordResetConfirmPayload): Promise<void> {
  await apiClient.post('/api/v1/users/password-reset/confirm', payload);
}
