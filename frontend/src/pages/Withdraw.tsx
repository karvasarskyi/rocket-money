import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { useSession } from '../hooks/AuthContext';
import { errorMessage, getWallet, getWithdrawalMethods, submitWithdrawal, WithdrawalConfig } from '../services/api';
import { money, toCents } from '../services/format';
import { haptic } from '../services/telegram';

const PLACEHOLDERS: Record<string, string> = {
  'Bank Transfer': 'Bank name, account holder, IBAN / account number, SWIFT',
  'USDT TRC-20': 'Your USDT TRC-20 wallet address (starts with T)',
  PayPal: 'Your PayPal email address',
};

export default function Withdraw() {
  const { wallet, setWallet } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [config, setConfig] = useState<WithdrawalConfig | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getWithdrawalMethods(), getWallet()])
      .then(([c, w]) => {
        setConfig(c);
        setMethod(c.methods[0] || '');
        setWallet(w);
      })
      .catch(err => toast(errorMessage(err), 'error'));
  }, [setWallet, toast]);

  const balance = Number(wallet?.balance || 0).toFixed(2);
  const min = config?.minWithdrawal || '25.00';

  const validation = useMemo(() => {
    if (!amount) return null;
    const cents = toCents(amount);
    if (cents === null) return 'Enter a valid amount (max 2 decimals)';
    if (cents < (toCents(min) || 0)) return `Minimum withdrawal is ${money(min)}`;
    if (cents > (toCents(balance) || 0)) return 'Amount exceeds your available balance';
    return null;
  }, [amount, min, balance]);

  const canSubmit = !!amount && !validation && !!method && details.trim().length >= 3 && !submitting;
  const belowMin = (toCents(balance) || 0) < (toCents(min) || 0);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await submitWithdrawal({ amount: amount.trim(), method, paymentDetails: details.trim() });
      haptic('success');
      toast('Withdrawal request submitted');
      setWallet(await getWallet());
      navigate('/wallet');
    } catch (err) {
      haptic('error');
      toast(errorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!config) {
    return (
      <Layout title="Withdraw" hideNav>
        <div className="py-20">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Withdraw" hideNav>
      <button onClick={() => navigate(-1)} className="text-sm text-muted mb-4">
        ← Back
      </button>
      <div className="bg-card rounded-2xl p-4 border border-white/5 flex justify-between items-center mb-5">
        <div>
          <p className="text-xs text-muted">Available balance</p>
          <p className="text-2xl font-bold">{money(balance)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Minimum</p>
          <p className="font-semibold text-accent">{money(min)}</p>
        </div>
      </div>

      {belowMin && (
        <div className="bg-yellow-400/10 border border-yellow-400/20 text-yellow-300 rounded-2xl p-4 text-sm mb-5">
          You need at least {money(min)} to withdraw. Invite friends to earn ${config.referralReward} each!
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="text-sm text-muted">Amount (USD)</label>
          <div className="mt-2 flex items-center bg-card rounded-2xl border border-white/10 focus-within:border-accent px-4">
            <span className="text-xl text-muted">$</span>
            <input
              value={amount}
              onChange={e => setAmount(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              placeholder={min}
              className="flex-1 bg-transparent py-4 px-2 text-xl font-semibold outline-none"
            />
            <button type="button" onClick={() => setAmount(balance)} className="text-xs font-semibold text-accent bg-accent/10 px-3 py-1.5 rounded-lg">
              MAX
            </button>
          </div>
          {validation && <p className="text-xs text-red-400 mt-2">{validation}</p>}
        </div>

        <div>
          <label className="text-sm text-muted">Method</label>
          <div className="grid gap-2 mt-2">
            {config.methods.map(m => (
              <button
                type="button"
                key={m}
                onClick={() => {
                  haptic('light');
                  setMethod(m);
                }}
                className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border text-sm font-medium transition ${
                  method === m ? 'border-accent bg-accent/10 text-white' : 'border-white/10 bg-card text-muted'
                }`}
              >
                {m}
                <span className={`w-4 h-4 rounded-full border-2 ${method === m ? 'border-accent bg-accent' : 'border-white/20'}`} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-muted">Payment details</label>
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={PLACEHOLDERS[method] || 'Where should we send your money?'}
            className="mt-2 w-full bg-card rounded-2xl border border-white/10 focus:border-accent px-4 py-3 text-sm outline-none resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-4 rounded-2xl bg-accent text-black font-semibold disabled:opacity-40 disabled:cursor-not-allowed shadow-neon flex justify-center"
        >
          {submitting ? <LoadingSpinner size={22} /> : 'Submit withdrawal'}
        </button>
        <p className="text-xs text-muted text-center">Requests are reviewed manually. Funds are reserved until processed.</p>
      </form>
    </Layout>
  );
}
