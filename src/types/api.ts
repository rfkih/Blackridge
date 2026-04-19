export type UUID = string;
export type ISO8601 = string;
export type EpochMs = number;

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: Record<string, string>;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  total: number;
}

export interface User {
  id: UUID;
  email: string;
  name: string;
  createdAt?: ISO8601;
}

export type AccountVenue = 'BINANCE_SPOT' | 'BINANCE_FUTURES';

export interface Account {
  id: UUID;
  userId: UUID;
  label: string;
  venue: AccountVenue;
  apiKeyMasked: string;
  testnet: boolean;
  createdAt: ISO8601;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RegisterResponse {
  token: string;
  user: User;
}
