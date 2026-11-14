import { useToast } from './Toast';
import { copyText, haptic, shareLink } from '../services/telegram';

export default function ReferralLinkCard({ link, reward }: { link: string; reward?: string }) {
  const toast = useToast();
  const copy = async () => {
    const ok = await copyText(link);
    haptic(ok ? 'success' : 'error');
    toast(ok ? 'Referral link copied' : 'Could not copy link', ok ? 'success' : 'error');
  };
  return (
    <div className="bg-card rounded-2xl p-4 border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold">Your referral link</p>
        {reward && <span className="text-xs text-accent bg-accent/10 px-2 py-1 rounded-full">${reward} per friend</span>}
      </div>
      <div className="bg-bg rounded-xl px-3 py-3 text-sm text-muted break-all font-mono">{link}</div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <button onClick={copy} className="py-3 rounded-xl border border-accent/40 text-accent font-semibold text-sm active:scale-95 transition">
          Copy link
        </button>
        <button
          onClick={() => {
            haptic('light');
            shareLink(link);
          }}
          className="py-3 rounded-xl bg-accent text-black font-semibold text-sm active:scale-95 transition"
        >
          Share
        </button>
      </div>
    </div>
  );
}
