import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import BalanceCard from '../components/BalanceCard';
import StatCard from '../components/StatCard';
import ReferralLinkCard from '../components/ReferralLinkCard';
import TransactionItem from '../components/TransactionItem';
import { useToast } from '../components/Toast';
import { useSession } from '../hooks/AuthContext';
import { errorMessage, getReferralStats, getTransactions, getWallet, ReferralStats, Transaction } from '../services/api';
import { money } from '../services/format';

export default function Home() {
  const { user, wallet, setWallet } = useSession();
  const toast = useToast();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [txs, setTxs] = useState<Transaction[] | null>(null);

  useEffect(() => {
    Promise.all([getWallet(), getReferralStats(), getTransactions(1, 5)])
      .then(([w, s, t]) => {
        setWallet(w);
        setStats(s);
        setTxs(t.items);
      })
      .catch(err => toast(errorMessage(err), 'error'));
  }, [setWallet, toast]);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-muted text-sm">Welcome back,</p>
          <h1 className="text-xl font-bold">{user?.firstName} 👋</h1>
        </div>
        <Link to="/profile" className="w-11 h-11 rounded-full bg-accent/15 text-accent font-bold flex items-center justify-center">
          {user?.firstName?.[0]?.toUpperCase()}
        </Link>
      </div>

      <BalanceCard
        balance={wallet?.balance || '0'}
        footer={
          <Link to="/withdraw" className="inline-flex items-center gap-2 bg-accent text-black text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition">
            Withdraw →
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 mt-4">
        {stats && wallet ? (
          <>
            <StatCard label="Total earned" value={money(wallet.totalEarned)} icon="💰" />
            <StatCard label="Referrals" value={stats.totalReferrals} icon="👥" />
            <StatCard label="Referral earnings" value={money(wallet.referralEarnings)} icon="🤝" />
            <StatCard label="Pending withdrawal" value={money(wallet.pendingWithdraw)} icon="⏳" />
          </>
        ) : (
          [0, 1, 2, 3].map(i => <div key={i} className="skeleton h-[76px]" />)
        )}
      </div>

      <div className="mt-4">
        {stats ? <ReferralLinkCard link={stats.referralLink} reward={stats.rewardPerReferral} /> : <div className="skeleton h-40" />}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold">Recent activity</h2>
          <Link to="/wallet" className="text-accent text-sm">
            See all
          </Link>
        </div>
        <div className="bg-card rounded-2xl px-4 border border-white/5 divide-y divide-white/5">
          {txs === null ? (
            [0, 1, 2].map(i => <div key={i} className="skeleton h-12 my-3" />)
          ) : txs.length ? (
            txs.map(tx => <TransactionItem key={tx.id} tx={tx} />)
          ) : (
            <p className="text-sm text-muted py-6 text-center">No activity yet</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
