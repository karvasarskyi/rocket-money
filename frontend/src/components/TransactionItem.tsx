import { Transaction } from '../services/api';
import { dateTime, money } from '../services/format';

const ICONS: Record<Transaction['type'], { emoji: string; bg: string }> = {
  REGISTRATION_BONUS: { emoji: '🎁', bg: 'bg-accent/10' },
  REFERRAL_REWARD: { emoji: '🤝', bg: 'bg-accent/10' },
  WITHDRAWAL: { emoji: '💸', bg: 'bg-red-500/10' },
  WITHDRAWAL_REVERSAL: { emoji: '↩️', bg: 'bg-blue-500/10' },
};

const STATUS_LABEL: Record<Transaction['status'], string> = {
  PENDING: 'Pending',
  COMPLETED: '',
  FAILED: 'Failed',
  REVERSED: 'Reversed',
};

export default function TransactionItem({ tx }: { tx: Transaction }) {
  const negative = tx.amount.startsWith('-');
  const icon = ICONS[tx.type];
  const status = STATUS_LABEL[tx.status];
  return (
    <div className="flex items-center gap-3 py-3">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg ${icon.bg}`}>{icon.emoji}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tx.description}</p>
        <p className="text-xs text-muted">
          {dateTime(tx.createdAt)}
          {status && <span className={`ml-2 ${tx.status === 'PENDING' ? 'text-yellow-400' : 'text-muted'}`}>• {status}</span>}
        </p>
      </div>
      <p className={`text-sm font-semibold ${negative ? 'text-red-400' : 'text-accent'} ${tx.status === 'REVERSED' ? 'line-through opacity-60' : ''}`}>
        {negative ? '-' : '+'}
        {money(tx.amount.replace('-', ''))}
      </p>
    </div>
  );
}
