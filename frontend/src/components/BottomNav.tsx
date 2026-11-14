import { NavLink } from 'react-router-dom';
import { haptic } from '../services/telegram';

const tabs = [
  { to: '/', label: 'Home', icon: 'M3 11.5L12 4l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-8.5z' },
  { to: '/referrals', label: 'Referrals', icon: 'M16 11a4 4 0 10-8 0M12 3a4 4 0 100 8 4 4 0 000-8zM4 21a8 8 0 0116 0' },
  { to: '/wallet', label: 'Wallet', icon: 'M3 7a2 2 0 012-2h13a1 1 0 011 1v2M3 7v11a2 2 0 002 2h14a1 1 0 001-1v-3M3 7h16a1 1 0 011 1v3m0 5h-4a2.5 2.5 0 010-5h4v5z' },
  { to: '/profile', label: 'Profile', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-bg/90 backdrop-blur-xl border-t border-white/5 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-4">
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            onClick={() => haptic('light')}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${isActive ? 'text-accent' : 'text-muted'}`
            }
          >
            {({ isActive }) => (
              <>
                <svg
                  className={`w-6 h-6 ${isActive ? 'drop-shadow-[0_0_8px_rgba(0,255,136,0.7)]' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d={t.icon} />
                </svg>
                {t.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
