import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { useToast } from '../components/Toast';
import { useSession } from '../hooks/AuthContext';
import { money, shortDate } from '../services/format';
import { copyText, haptic, WebApp } from '../services/telegram';

export default function Profile() {
  const { user, wallet } = useSession();
  const toast = useToast();
  const photo = WebApp?.initDataUnsafe?.user?.photo_url;
  if (!user) return null;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');

  const copyCode = async () => {
    const ok = await copyText(user.referralCode);
    haptic(ok ? 'success' : 'error');
    toast(ok ? 'Referral code copied' : 'Could not copy', ok ? 'success' : 'error');
  };

  return (
    <Layout title="Profile">
      <div className="flex flex-col items-center text-center mb-6">
        {photo ? (
          <img src={photo} alt="" className="w-24 h-24 rounded-full border-2 border-accent shadow-neon object-cover" />
        ) : (
          <div className="w-24 h-24 rounded-full bg-accent/15 border-2 border-accent shadow-neon text-accent text-4xl font-bold flex items-center justify-center">
            {user.firstName[0]?.toUpperCase()}
          </div>
        )}
        <h2 className="text-xl font-bold mt-3">{fullName}</h2>
        {user.username && <p className="text-muted text-sm">@{user.username}</p>}
      </div>

      <div className="bg-card rounded-2xl p-4 border border-white/5 space-y-3 text-sm">
        <div className="flex justify-between"><span className="text-muted">Telegram ID</span><span className="font-mono">{user.telegramId}</span></div>
        <div className="flex justify-between"><span className="text-muted">Member since</span><span>{shortDate(user.createdAt)}</span></div>
        <div className="flex justify-between items-center">
          <span className="text-muted">Referral code</span>
          <button onClick={copyCode} className="font-mono font-semibold text-accent bg-accent/10 px-3 py-1 rounded-lg">
            {user.referralCode} ⧉
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <StatCard label="Balance" value={money(wallet?.balance)} icon="💵" />
        <StatCard label="Total earned" value={money(wallet?.totalEarned)} icon="📈" />
        <StatCard label="Friends invited" value={user.referralCount} icon="👥" />
        <StatCard label="Withdrawn" value={money(wallet?.totalWithdrawn)} icon="🏦" />
      </div>

      <p className="text-center text-xs text-muted mt-8">Rocket Money · Invite friends, earn rewards</p>
    </Layout>
  );
}
