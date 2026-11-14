import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import BalanceCard from '../components/BalanceCard';
import StatCard from '../components/StatCard';
import TransactionItem from '../components/TransactionItem';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { useSession } from '../hooks/AuthContext';
import { errorMessage, getMyWithdrawals, getTransactions, getWallet, Transaction, Withdrawal } from '../services/api';
import { money, shortDate, toCents } from '../services/format';

const STATUS_STYLE: Record<Withdrawal['status'], string> = {
  PENDING: 'text-yellow-400 bg-yellow-400/10',
  PROCESSING: 'text-blue-400 bg-blue-400/10',
  APPROVED: 'text-cyan-400 bg-cyan-400/10',
  PAID: 'text-accent bg-accent/10',
  REJECTED: 'text-red-400 bg-red-400/10',
};

export default function Wallet() {
  const { wallet, setWallet } = useSession();
  const toast = useToast();
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    Promise.all([getWallet(), getTransactions(1, 20), getMyWithdrawals()])
      .then(([w, t, wd]) => {
        setWallet(w);
        setTxs(t.items);
        setPages(t.pages || 1);
        setWithdrawals(wd);
      })
      .catch(err => toast(errorMessage(err), 'error'));
  }, [setWallet, toast]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const t = await getTransactions(page + 1, 20);
      setTxs(prev => [...(prev || []), ...t.items]);
      setPage(page + 1);
      setPages(t.pages || 1);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLoadingMore(false);
    }
  }, [page, toast]);

  const min = wallet?.minWithdrawal || '25.00';
  const balanceCents = toCents(Number(wallet?.balance || 0).toFixed(2)) || 0;
  const minCents = toCents(min) || 0;
  const progress = minCents ? Math.min(100, Math.round((balanceCents / minCents) * 100)) : 100;
  const canWithdraw = balanceCents >= minCents;

  return (
    <Layout title="Wallet">
      <BalanceCard
        balance={wallet?.balance || '0'}
        footer={
          <div>
            <div className="flex justify-between text-xs text-muted mb-1.5">
              <span>Withdrawal progress</span>
              <span>
                {money(wallet?.balance)} / {money(min)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        }
      />

      <Link
        to="/withdraw"
        className={`mt-4 block text-center py-4 rounded-2xl font-semibold transition active:scale-[0.98] ${
          canWithdraw ? 'bg-accent text-black shadow-neon' : 'bg-card text-muted border border-white/5'
        }`}
      >
        {canWithdraw ? 'Withdraw funds' : `Withdraw (min ${money(min)})`}
      </Link>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <StatCard label="Total earned" value={money(wallet?.totalEarned)} />
        <StatCard label="Total withdrawn" value={money(wallet?.totalWithdrawn)} />
      </div>

      <div className="bg-card rounded-2xl p-4 border border-white/5 mt-4 space-y-3 text-sm">
        <p className="font-semibold">Earnings breakdown</p>
        <div className="flex justify-between"><span className="text-muted">Welcome bonus</span><span>{money(wallet?.registrationBonus)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Referral earnings</span><span>{money(wallet?.referralEarnings)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Pending withdrawal</span><span className="text-yellow-400">{money(wallet?.pendingWithdraw)}</span></div>
      </div>

      {withdrawals.length > 0 && (
        <>
          <h2 className="font-semibold mt-6 mb-2">Withdrawal requests</h2>
          <div className="bg-card rounded-2xl px-4 border border-white/5 divide-y divide-white/5">
            {withdrawals.map(w => (
              <div key={w.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{w.method}</p>
                  <p className="text-xs text-muted">{shortDate(w.createdAt)}{w.adminNote ? ` · ${w.adminNote}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{money(w.amount)}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[w.status]}`}>{w.status}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="font-semibold mt-6 mb-2">Transaction history</h2>
      <div className="bg-card rounded-2xl px-4 border border-white/5 divide-y divide-white/5">
        {txs === null ? (
          [0, 1, 2, 3].map(i => <div key={i} className="skeleton h-12 my-3" />)
        ) : txs.length ? (
          txs.map(tx => <TransactionItem key={tx.id} tx={tx} />)
        ) : (
          <p className="text-sm text-muted py-6 text-center">No transactions yet</p>
        )}
      </div>
      {txs && page < pages && (
        <button onClick={loadMore} disabled={loadingMore} className="w-full mt-3 py-3 rounded-xl border border-white/10 text-sm text-muted">
          {loadingMore ? <LoadingSpinner size={20} /> : 'Load more'}
        </button>
      )}
    </Layout>
  );
}
