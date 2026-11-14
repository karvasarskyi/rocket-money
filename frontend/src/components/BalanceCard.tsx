import { ReactNode } from 'react';
import { money } from '../services/format';

export default function BalanceCard({ balance, label = 'Available balance', footer }: { balance: string; label?: string; footer?: ReactNode }) {
  return (
    <div className="rounded-3xl p-[1.5px] bg-gradient-to-br from-accent via-accent/30 to-transparent shadow-neon">
      <div className="rounded-3xl bg-gradient-to-br from-[#0f1f17] via-card to-card p-6 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-accent/10 blur-2xl" />
        <p className="text-sm text-muted">{label}</p>
        <p className="text-4xl font-extrabold mt-2 tracking-tight">{money(balance)}</p>
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  );
}
