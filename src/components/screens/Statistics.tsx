import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { calculateBalances, perPersonStats } from '../../lib/accounting';
import { formatCurrency, formatSignedCurrency } from '../../lib/format';
import { sortPeople } from '../../lib/people';

export function Statistics() {
  const rawPeople = useStore((s) => s.people);
  const people = useMemo(() => sortPeople(rawPeople), [rawPeople]);
  const transactions = useStore((s) => s.transactions);
  const currency = useStore((s) => s.settings.currency);

  const expenses = useMemo(
    () => transactions.filter((t) => t.type === 'expense'),
    [transactions],
  );
  const transfers = useMemo(
    () => transactions.filter((t) => t.type === 'transfer'),
    [transactions],
  );
  const totalSpent = expenses.reduce((s, t) => s + t.amountCents, 0);
  const totalRepaid = transfers.reduce((s, t) => s + t.amountCents, 0);
  const stats = perPersonStats(people.map((p) => p.id), transactions);
  const balances = calculateBalances(people.map((p) => p.id), transactions);

  const categoryTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) {
      m.set(e.category, (m.get(e.category) ?? 0) + e.amountCents);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total spent" value={formatCurrency(totalSpent, currency)} />
        <StatCard label="Expenses" value={expenses.length.toString()} />
        <StatCard label="Repayments" value={transfers.length.toString()} />
        <StatCard label="Repaid total" value={formatCurrency(totalRepaid, currency)} />
      </div>

      <section className="card p-5">
        <h3 className="text-base font-semibold mb-3">Per person</h3>
        <div className="space-y-3">
          {people.map((p) => {
            const paid = stats[p.id]?.paid ?? 0;
            const share = stats[p.id]?.share ?? 0;
            const net = balances[p.id] ?? 0;
            return (
              <div key={p.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <div className="font-semibold mb-2">{p.name}</div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Paid</div>
                    <div className="font-semibold tabular-nums">
                      {formatCurrency(paid, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Consumed</div>
                    <div className="font-semibold tabular-nums">
                      {formatCurrency(share, currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Net</div>
                    <div
                      className={`font-semibold tabular-nums ${
                        net > 0
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : net < 0
                            ? 'text-rose-700 dark:text-rose-300'
                            : ''
                      }`}
                    >
                      {formatSignedCurrency(net, currency)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {categoryTotals.length > 0 && (
        <section className="card p-5">
          <h3 className="text-base font-semibold mb-3">Spending by category</h3>
          <ul className="space-y-2">
            {categoryTotals.map(([cat, total]) => {
              const pct = totalSpent === 0 ? 0 : (total / totalSpent) * 100;
              return (
                <li key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{cat}</span>
                    <span className="tabular-nums text-slate-600 dark:text-slate-300">
                      {formatCurrency(total, currency)} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="text-xl font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );
}
