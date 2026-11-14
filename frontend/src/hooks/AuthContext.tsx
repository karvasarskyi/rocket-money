import { createContext, useContext } from 'react';
import { AuthState } from './useAuth';

export const AuthContext = createContext<AuthState | null>(null);

export function useSession(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useSession must be used inside AuthContext');
  return ctx;
}
