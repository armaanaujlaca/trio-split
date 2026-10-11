import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { calculateBalances } from '../../lib/accounting';
import { sortPeople } from '../../lib/people';
import { calculateSettlement, isAllSettled } from '../../lib/settlement';
import {
  formatCurrency,
  formatDate,
  formatPayerSummary,
  formatSignedCurrency,
} from '../../lib/format';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Plus,
  Receipt,
  Send,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ExpenseForm } from '../forms/ExpenseForm';
import { TransferForm } from '../forms/TransferForm';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import type { Expense, Transfer } from '../../types';

interface Props {
  onNavigate: (tab: 'history' | 'stats') => void;
}

export function Dashboard({ onNavigate }: Props) {
  const rawPeople = useStore((s) => s.people);
  const people = useMemo(() => sortPeople(rawPeople), [rawPeople]);
  const transactions = useStore((s) => s.transactions);
  const currency = useStore((s) => s.settings.currency);
  const settleAll = useStore((s) => s.settleAll);
  const toast = useToast();

  const [showExpense, setShowExpense] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferDefaults, setTransferDefaults] = useState<{
    from?: string;
    to?: string;
    amountCents?: number;
  }>({});
  const [confirmSettle, setConfirmSettle] = useState(false);

  const balances = useMemo(
    () => calculateBalances(people.map((p) => p.id), transactions),
    [people, transactions],
  );
  const settlement = useMemo(() => calculateSettlement(balances), [balances]);
  const settled = isAllSettled(balances);
  const totalSpent = useMemo(
    () =>
      transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountCents, 0),
    [transactions],
  );
  const recent = useMemo(
    () => [...transactions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    [transactions],
  );
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? '—';

  const copySettlement = () => {
    if (settlement.length === 0) {
      toast.show('Everyone is settled — nothing to copy', { variant: 'info' });
      return;
    }
    const text = settlement
      .map(
        (p) =>
          `${nameOf(p.from)} owes ${nameOf(p.to)} ${formatCurrency(p.amountCents, currency)}`,
      )
      .join('\n');
    navigator.clipboard?.writeText(text).then(
      () => toast.show('Settlement copied'),
      () => toast.show('Could not copy', { variant: 'error' }),
    );
  };

  const handleSettleAll = () => {
    const made = settleAll();
    setConfirmSettle(false);
    toast.show(
      made.length === 0 ? 'Everyone was already settled' : `Recorded ${made.length} transfer${made.length === 1 ? '' : 's'}`,
    );
  };

  const openTransferForDebt = (fromId: string, toId: string, amountCents: number) => {
    setTransferDefaults({ from: fromId, to: toId, amountCents });
    setShowTransfer(true);
  };

  return (
    <div className="space-y-5">
      {/* Who owes who — hero section */}
      <section className="card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-brand-500" />
            Who owes who?
          </h2>
          {settlement.length > 0 && (
            <button className="btn-ghost text-sm" onClick={copySettlement}>
              <Copy className="w-4 h-4" />
              Copy
            </button>
          )}
        </div>

        {settled ? (
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-xl font-semibold">Everyone is settled</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              All balances are at $0.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {settlement.map((p, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 justify-between bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold truncate">{nameOf(p.from)}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold truncate">{nameOf(p.to)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums text-brand-600 dark:text-brand-300">
                    {formatCurrency(p.amountCents, currency)}
                  </span>
                  <button
                    className="btn-ghost text-xs !px-2 !py-1"
                    onClick={() => openTransferForDebt(p.from, p.to, p.amountCents)}
                  >
                    Record
                  </button>
                </div>
              </li>
            ))}
            <button
              className="btn-primary w-full mt-2"
              onClick={() => setConfirmSettle(true)}
            >
              Mark everyone as settled
            </button>
          </ul>
        )}
      </section>

      {/* Balances */}
      <section className="card p-5">
        <h3 className="text-base font-semibold mb-3">Current balances</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {people.map((p) => {
            const b = balances[p.id] ?? 0;
            const positive = b > 0;
            const negative = b < 0;
            return (
              <div
                key={p.id}
                className={`rounded-xl p-4 border ${
                  positive
                    ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40'
                    : negative
                      ? 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40'
                }`}
              >
                <div className="text-sm text-slate-600 dark:text-slate-300">{p.name}</div>
                <div
                  className={`text-2xl font-bold tabular-nums ${
                    positive
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : negative
                        ? 'text-rose-700 dark:text-rose-300'
                        : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {formatSignedCurrency(b, currency)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {positive ? 'is owed' : negative ? 'owes' : 'settled'}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />
          Positive = owed money &nbsp;
          <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1 ml-1" />
          Negative = owes money
        </div>
      </section>

      {/* Totals + Recent */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Total spent</div>
              <div className="text-2xl font-bold tabular-nums">
                {formatCurrency(totalSpent, currency)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-950 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-brand-600 dark:text-brand-300" />
            </div>
          </div>
          <button
            className="btn-ghost mt-2 text-sm !px-0"
            onClick={() => onNavigate('stats')}
          >
            View statistics
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold">Recent</h3>
            <button className="btn-ghost text-sm !px-0" onClick={() => onNavigate('history')}>
              See all
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              No transactions yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    {t.type === 'expense' ? (
                      <>
                        <div className="font-medium truncate">
                          {(t as Expense).description || t.category}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatPayerSummary((t as Expense).payments, nameOf, currency)} ·{' '}
                          {formatDate(t.date)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium truncate">
                          {nameOf((t as Transfer).from)} → {nameOf((t as Transfer).to)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Repayment · {formatDate(t.date)}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="font-semibold tabular-nums shrink-0 ml-3">
                    {formatCurrency(t.amountCents, currency)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Quick actions (above bottom nav) */}
      <section className="flex gap-3 sm:hidden">
        <button className="btn-secondary flex-1" onClick={() => setShowTransfer(true)}>
          <Send className="w-4 h-4" /> Repayment
        </button>
        <button className="btn-primary flex-1" onClick={() => setShowExpense(true)}>
          <Plus className="w-4 h-4" /> Expense
        </button>
      </section>
      <section className="hidden sm:flex gap-3 justify-end">
        <button className="btn-secondary" onClick={() => setShowTransfer(true)}>
          <Send className="w-4 h-4" /> Add repayment
        </button>
        <button className="btn-primary" onClick={() => setShowExpense(true)}>
          <Receipt className="w-4 h-4" /> Add expense
        </button>
      </section>

      <Modal open={showExpense} onClose={() => setShowExpense(false)} title="Add expense" size="lg">
        <ExpenseForm onDone={() => setShowExpense(false)} />
      </Modal>
      <Modal
        open={showTransfer}
        onClose={() => {
          setShowTransfer(false);
          setTransferDefaults({});
        }}
        title="Add repayment"
      >
        <TransferForm
          defaults={transferDefaults}
          onDone={() => {
            setShowTransfer(false);
            setTransferDefaults({});
          }}
        />
      </Modal>
      <ConfirmDialog
        open={confirmSettle}
        title="Mark everyone as settled?"
        description={
          <>
            This will record {settlement.length} repayment{settlement.length === 1 ? '' : 's'} to
            zero every balance:
            <ul className="mt-2 space-y-1">
              {settlement.map((p, i) => (
                <li key={i} className="font-medium">
                  {nameOf(p.from)} → {nameOf(p.to)}: {formatCurrency(p.amountCents, currency)}
                </li>
              ))}
            </ul>
            <div className="mt-3 text-xs">
              Your previous expenses and repayments stay in history.
            </div>
          </>
        }
        confirmLabel="Record settlement"
        onCancel={() => setConfirmSettle(false)}
        onConfirm={handleSettleAll}
      />
    </div>
  );
}
