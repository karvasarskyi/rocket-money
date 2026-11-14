import { useCallback, useEffect, useRef, useState } from 'react';
import { authInit, errorMessage, setUnauthorizedHandler, tokenStore, User, Wallet } from '../services/api';
import { WebApp } from '../services/telegram';

export interface AuthState {
  loading: boolean;
  error: string | null;
  user: User | null;
  wallet: Wallet | null;
  isNew: boolean;
  retry: () => void;
  setWallet: (w: Wallet) => void;
}

function getStartParam(): string | undefined {
  const fromTelegram = WebApp?.initDataUnsafe?.start_param;
  if (fromTelegram) return fromTelegram;
  const params = new URLSearchParams(window.location.search);
  return params.get('ref') || params.get('tgWebAppStartParam') || undefined;
}

/**
 * Authenticates with the backend using Telegram WebApp initData (signed by Telegram and verified server-side).
 * Stores the returned JWT in localStorage for subsequent API calls.
 */
export function useAuth(): AuthState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);

  const retry = useCallback(() => setAttempt(a => a + 1), []);

  useEffect(() => {
    setUnauthorizedHandler(() => setAttempt(a => a + 1));
  }, []);

  useEffect(() => {
    if (running.current) return;
    running.current = true;
    setLoading(true);
    setError(null);
    try {
      WebApp.ready();
      WebApp.expand();
      WebApp.setHeaderColor('#0A0A0A');
      WebApp.setBackgroundColor('#0A0A0A');
    } catch {
      /* outside Telegram */
    }
    authInit(WebApp?.initData || '', getStartParam())
      .then(res => {
        tokenStore.set(res.token);
        setUser(res.user);
        setWallet(res.wallet);
        setIsNew(res.isNew);
      })
      .catch(err => {
        tokenStore.clear();
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(status === 401 ? 'Please open Rocket Money from the Telegram bot to sign in.' : errorMessage(err));
      })
      .finally(() => {
        setLoading(false);
        running.current = false;
      });
  }, [attempt]);

  return { loading, error, user, wallet, isNew, retry, setWallet };
}
