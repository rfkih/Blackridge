// SLICE 1: useAuth hook — login / logout / register mutations + /me query.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { apiClient, normalizeError } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  User,
} from '@/types/api';

const ME_QUERY_KEY = ['auth', 'me'] as const;

async function postLogin(payload: LoginRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/api/v1/users/login', payload);
  return data;
}

async function postRegister(payload: RegisterRequest): Promise<RegisterResponse> {
  const { data } = await apiClient.post<RegisterResponse>('/api/v1/users/register', payload);
  return data;
}

async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/api/v1/users/me');
  return data;
}

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    enabled: Boolean(token) && !user,
    staleTime: 60_000,
    retry: 0,
  });

  // Mirror /me result into the store (TanStack Query owns the fetch; effect only syncs).
  useEffect(() => {
    if (meQuery.data && meQuery.data.id !== user?.id) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, user?.id, setUser]);

  const loginMutation = useMutation({
    mutationFn: postLogin,
    onSuccess: ({ token: nextToken, user: nextUser }) => {
      setAuth(nextToken, nextUser);
      queryClient.setQueryData(ME_QUERY_KEY, nextUser);
    },
  });

  const registerMutation = useMutation({
    mutationFn: postRegister,
    onSuccess: ({ token: nextToken, user: nextUser }) => {
      setAuth(nextToken, nextUser);
      queryClient.setQueryData(ME_QUERY_KEY, nextUser);
    },
  });

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        await loginMutation.mutateAsync({ email, password });
      } catch (err) {
        throw new Error(normalizeError(err));
      }
    },
    [loginMutation],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      try {
        await registerMutation.mutateAsync({ email, password, name });
      } catch (err) {
        throw new Error(normalizeError(err));
      }
    },
    [registerMutation],
  );

  const logout = useCallback(() => {
    clearAuth();
    queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
    queryClient.clear();
    router.push('/login');
  }, [clearAuth, queryClient, router]);

  const isLoading =
    loginMutation.isPending || registerMutation.isPending || (meQuery.isLoading && !user);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    register,
  };
}
