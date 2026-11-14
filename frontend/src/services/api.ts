import axios, { AxiosError } from 'axios';
import WebApp from '@twa-dev/sdk';

const TOKEN_KEY = 'rm_token';

export interface User {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  referralCode: string;
  referralLink: string;
  referralCount: number;
  isBlocked: boolean;
  createdAt: string;
}

export interface Wallet {
  balance: string;
  totalEarned: string;
  totalWithdrawn: string;
  pendingWithdraw: string;
  registrationBonus: string;
  referralEarnings: string;
  minWithdrawal?: string;
}

export type TransactionType = 'REGISTRATION_BONUS' | 'REFERRAL_REWARD' | 'WITHDRAWAL' | 'WITHDRAWAL_REVERSAL';
export interface Transaction {
  id: string;
  type: TransactionType;
  amount: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  description: string;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages?: number;
}

export interface ReferralStats {
  totalReferrals: number;
  todayReferrals: number;
  referralEarnings: string;
  rewardPerReferral: string;
  referralCode: string;
  referralLink: string;
}

export interface ReferralItem {
  id: string;
  name: string;
  username: string | null;
  rewardAmount: string;
  rewardPaid: boolean;
  joinedAt: string;
}

export interface WithdrawalConfig {
  methods: string[];
  minWithdrawal: string;
  registrationBonus: string;
  referralReward: string;
}

export interface Withdrawal {
  id: string;
  amount: string;
  method: string;
  paymentDetails: string;
  status: 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'PAID';
  adminNote: string | null;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  wallet: Wallet;
  isNew: boolean;
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '').replace(/\/+$/, ''),
  timeout: 20000,
});

api.interceptors.request.use(config => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Always attach the signed Telegram launch data so the backend can (re)verify the user.
  const initData = WebApp?.initData;
  if (initData) config.headers['X-Telegram-Init-Data'] = initData;
  return config;
});

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  r => r,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !String(error.config?.url).includes('/api/auth/telegram')) {
      tokenStore.clear();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

export function errorMessage(err: unknown): string {
  const e = err as AxiosError<{ message?: string | string[] }>;
  const data = e?.response?.data as unknown;
  const msg = data && typeof data === 'object' ? (data as { message?: string | string[] }).message : undefined;
  if (Array.isArray(msg)) return msg.join(', ');
  if (msg) return msg;
  if (e?.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
  const status = e?.response?.status;
  if (status && status >= 500) {
    // Non-JSON body (e.g. a platform error page): show the first line so the cause is visible.
    const text = typeof data === 'string' ? data.replace(/<[^>]+>/g, ' ').trim().split('\n').filter(Boolean).slice(0, 2).join(' · ').slice(0, 160) : '';
    return `Server error (${status})${text ? `: ${text}` : ''}. Open /api/health on this domain for details.`;
  }
  return e?.message || 'Something went wrong';
}

export const authInit = (initData: string, startParam?: string) =>
  api.post<AuthResponse>('/api/auth/telegram', { initData, startParam }).then(r => r.data);
export const getMe = () => api.get<{ user: User; wallet: Wallet }>('/api/users/me').then(r => r.data);
export const getWallet = () => api.get<Wallet>('/api/wallet/me').then(r => r.data);
export const getTransactions = (page = 1, limit = 20) =>
  api.get<Paginated<Transaction>>('/api/users/me/transactions', { params: { page, limit } }).then(r => r.data);
export const getReferralStats = () => api.get<ReferralStats>('/api/referrals/me/stats').then(r => r.data);
export const getReferrals = (page = 1) =>
  api.get<Paginated<ReferralItem>>('/api/referrals/me/list', { params: { page } }).then(r => r.data);
export const getWithdrawalMethods = () => api.get<WithdrawalConfig>('/api/settings/withdrawal-methods').then(r => r.data);
export const submitWithdrawal = (data: { amount: string; method: string; paymentDetails: string }) =>
  api.post<Withdrawal>('/api/withdrawals', data).then(r => r.data);
export const getMyWithdrawals = () => api.get<Withdrawal[]>('/api/withdrawals/my').then(r => r.data);
