import type { AuthTokens, UserProfile } from '@orbit/types';
import { api } from '@/lib/api';
import type { RegisterInput } from '../types';

export async function login(email: string, password: string): Promise<AuthTokens> {
  const res = await api.post<AuthTokens>('/api/auth/login', { email, password });
  return res.data;
}

// Field rules are enforced by registerSchema in apps/server/src/routes/auth.ts; its message is shown on failure.
export async function register(input: RegisterInput): Promise<AuthTokens> {
  const res = await api.post<AuthTokens>('/api/auth/register', input);
  return res.data;
}

export async function getMe(): Promise<UserProfile> {
  const res = await api.get<UserProfile>('/api/auth/me');
  return res.data;
}
