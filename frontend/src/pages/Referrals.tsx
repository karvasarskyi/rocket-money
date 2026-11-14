import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import ReferralLinkCard from '../components/ReferralLinkCard';
import RocketIcon from '../components/RocketIcon';
import { useToast } from '../components/Toast';
import { errorMessage, getReferralStats, getReferrals, ReferralItem, ReferralStats } from '../services/api';
import { money, shortDate } from '../services/format';
import { haptic, shareLink } from '../services/telegram';

export default function Referrals() {
  const toast = useToast();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [list, setList] = useState<ReferralItem[] | null>(null);

  useEffect(() => {
    Promise.all([getReferralStats(), getReferrals()])
      .then(([s, l]) => {
        setStats(s);
        setList(l.items);
      })
      .catch(err => toast(errorMessage(err), 'error'));
  }, [toast]);

  return (
    <Layout title="Referrals">
      <div className="bg-gradient-to-br from-accent/20 to-transparent rounded-3xl p-5 border border-accent/20 mb-4">
        <p className="text-sm text-muted">Earn for every friend</p>
        <p className="text-3xl font-extrabold mt-1">
          {stats ? `$${stats.rewardPerReferral}` : '—'} <span className="text-base font-medium text-muted">per invite</span>
        </p>
        <p className="text-xs text-muted mt-2">Your friend gets a welcome bonus, you get a reward as soon as they join.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {stats ? (
          <>
            <StatCard label="Total" value={stats.totalReferrals} />
            <StatCard label="Today" value={stats.todayReferrals} />
            <StatCard label="Earned" value={money(stats.referralEarnings)} />
          </>
        ) : (
          [0, 1, 2].map(i => <div key={i} className="skeleton h-[76px]" />)
        )}
      </div>

      {stats ? <ReferralLinkCard link={stats.referralLink} reward={stats.rewardPerReferral} /> : <div className="skeleton h-40" />}

      <h2 className="font-semibold mt-6 mb-2">Your friends</h2>
      {list === null ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="skeleton h-16" />)}</div>
      ) : list.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 border border-white/5 text-center flex flex-col items-center">
          <RocketIcon className="w-24 h-24 mb-3" />
          <p className="font-semibold">No referrals yet</p>
          <p className="text-sm text-muted mt-1 mb-4">Share your link and start earning today.</p>
          {stats && (
            <button
              onClick={() => {
                haptic('light');
                shareLink(stats.referralLink);
              }}
              className="px-6 py-3 rounded-xl bg-accent text-black font-semibold text-sm"
            >
              Invite friends
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-2xl px-4 border border-white/5 divide-y divide-white/5">
          {list.map(r => (
            <div key={r.id} className="flex items-center gap-3 py-3">
              <div className="w-10 h-10 rounded-full bg-accent/15 text-accent font-bold flex items-center justify-center">
                {r.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-xs text-muted">
                  {r.username ? `@${r.username} · ` : ''}Joined {shortDate(r.joinedAt)}
                </p>
              </div>
              <p className="text-sm font-semibold text-accent">+{money(r.rewardAmount)}</p>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
