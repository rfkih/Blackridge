
import { apiClient } from './client';

export async function verifyEmail(token: string): Promise<void> {
  await apiClient.post('/api/v1/users/email/verify', { token });
}

export async function resendVerificationEmail(): Promise<void> {
  await apiClient.post('/api/v1/users/email/resend-verification');
}
