// Email-verification API. /verify is public (token IS the auth);
// /resend-verification requires the user's session.
import { apiClient } from './client';

export async function verifyEmail(token: string): Promise<void> {
  await apiClient.post('/api/v1/users/email/verify', { token });
}

export async function resendVerificationEmail(): Promise<void> {
  await apiClient.post('/api/v1/users/email/resend-verification');
}
