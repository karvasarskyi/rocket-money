import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AuthContext } from './hooks/AuthContext';
import LoadingSpinner from './components/LoadingSpinner';
import RocketIcon from './components/RocketIcon';
import { useToast } from './components/Toast';
import { WebApp } from './services/telegram';
import { money } from './services/format';
import Home from './pages/Home';
import Referrals from './pages/Referrals';
import Wallet from './pages/Wallet';
import Withdraw from './pages/Withdraw';
import Profile from './pages/Profile';

/** Shows Telegram's native back button on nested pages. */
function TelegramBackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    try {
      const back = WebApp.BackButton;
      const handler = () => navigate(-1);
      if (location.pathname === '/withdraw') {
        back.show();
        back.onClick(handler);
        return () => {
          back.offClick(handler);
          back.hide();
        };
      }
      back.hide();
    } catch {
      /* outside Telegram */
    }
    return undefined;
  }, [location.pathname, navigate]);
  return null;
}

export default function App() {
  const auth = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (auth.isNew && auth.wallet) toast(`Welcome! ${money(auth.wallet.registrationBonus)} bonus added 🎉`);
  }, [auth.isNew, auth.wallet, toast]);

  if (auth.loading && !auth.user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-bg">
        <RocketIcon className="w-24 h-24 animate-pulse" />
        <LoadingSpinner label="Launching Rocket Money…" />
      </div>
    );
  }

  if (auth.error || !auth.user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
        <RocketIcon className="w-24 h-24" />
        <h1 className="text-xl font-bold">Unable to sign in</h1>
        <p className="text-muted text-sm max-w-xs">{auth.error || 'Unknown error'}</p>
        <button onClick={auth.retry} className="mt-2 px-6 py-3 rounded-xl bg-accent text-black font-semibold">
          Try again
        </button>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <TelegramBackButton />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/referrals" element={<Referrals />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/withdraw" element={<Withdraw />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}
