import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  calculateEqualShares,
  validateExpense,
} from '../../lib/accounting';
import { centsToDollarString, parseAmountToCents, todayISO } from '../../lib/format';
import { sortPeople } from '../../lib/people';
import { useToast } from '../ui/Toast';
import { AddPersonChip } from '../ui/AddPersonChip';
import type { Expense, ExpensePayment, ExpenseShare, PersonId, SplitType } from '../../types';
import { Plus } from 'lucide-react';

interface Props {
  initial?: Expense;
  onDone: () => void;
}

const LAST_CATEGORY_KEY = 'trio-split:lastCategory';

export function ExpenseForm({ initial, onDone }: Props) {
  const rawPeople = useStore((s) => s.people);
  const people = useMemo(() => sortPeople(rawPeople), [rawPeople]);
  const categories = useStore((s) => s.categories);
  const addExpense = useStore((s) => s.addExpense);
  const updateExpense = useStore((s) => s.updateExpense);
  const addCategory = useStore((s) => s.addCategory);
  const toast = useToast();

  const lastCategory =
    (typeof localStorage !== 'undefined' && localStorage.getItem(LAST_CATEGORY_KEY)) || 'Other';

  const [amountStr, setAmountStr] = useState<string>(
    initial ? centsToDollarString(initial.amountCents) : '',
  );
  const [date, setDate] = useState<string>(initial?.date ?? todayISO());
  const [description, setDescription] = useState<string>(initial?.description ?? '');
  const [category, setCategory] = useState<string>(initial?.category ?? lastCategory);
  const [participants, setParticipants] = useState<PersonId[]>(
    initial?.participants ?? people.map((p) => p.id),
  );
  const [splitType, setSplitType] = useState<SplitType>(initial?.splitType ?? 'equal');
  const [customShares, setCustomShares] = useState<Record<PersonId, string>>(() => {
    if (initial?.splitType === 'custom') {
      const m: Record<string, string> = {};
      for (const s of initial.shares) m[s.personId] = centsToDollarString(s.amountCents);
      return m;
    }
    return {};
  });

  // Payers: who paid, and (when more than one person chipped in) how much each paid.
  const [payers, setPayers] = useState<PersonId[]>(() => {
    if (initial) return initial.payments.map((p) => p.personId);
    return people[0] ? [people[0].id] : [];
  });
  const [paymentAmounts, setPaymentAmounts] = useState<Record<PersonId, string>>(() => {
    if (initial && initial.payments.length > 1) {
      const m: Record<string, string> = {};
      for (const p of initial.payments) m[p.personId] = centsToDollarString(p.amountCents);
      return m;
    }
    return {};
  });

  const [newCategory, setNewCategory] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const amountCents = parseAmountToCents(amountStr) ?? 0;

  const equalShares = useMemo(
    () => calculateEqualShares(amountCents, participants),
    [amountCents, participants],
  );
  const equalPayments = useMemo(
    () => calculateEqualShares(amountCents, payers),
    [amountCents, payers],
  );

  const effectiveShares: ExpenseShare[] = useMemo(() => {
    if (splitType === 'equal') return equalShares;
    return participants.map((pid) => ({
      personId: pid,
      amountCents: parseAmountToCents(customShares[pid] ?? '') ?? 0,
    }));
  }, [splitType, equalShares, participants, customShares]);

  const effectivePayments: ExpensePayment[] = useMemo(() => {
    if (payers.length <= 1) {
      return payers.map((pid) => ({ personId: pid, amountCents }));
    }
    return payers.map((pid) => ({
      personId: pid,
      amountCents: parseAmountToCents(paymentAmounts[pid] ?? '') ?? 0,
    }));
  }, [payers, amountCents, paymentAmounts]);

  const sharesSum = effectiveShares.reduce((s, x) => s + x.amountCents, 0);
  const sharesDelta = sharesSum - amountCents;
  const paymentsSum = effectivePayments.reduce((s, x) => s + x.amountCents, 0);
  const paymentsDelta = paymentsSum - amountCents;

  const toggleParticipant = (id: PersonId) => {
    setParticipants((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      // Keep original order from `people`.
      return people.filter((p) => next.includes(p.id)).map((p) => p.id);
    });
  };

  const togglePayer = (id: PersonId) => {
    setPayers((cur) => {
      if (cur.includes(id)) {
        if (cur.length === 1) return cur; // always keep at least one payer
        return people.filter((p) => cur.includes(p.id) && p.id !== id).map((p) => p.id);
      }
      const next = [...cur, id];
      return people.filter((p) => next.includes(p.id)).map((p) => p.id);
    });
  };

  const splitPaymentsEvenly = () => {
    setPaymentAmounts(() => {
      const m: Record<string, string> = {};
      for (const s of equalPayments) m[s.personId] = centsToDollarString(s.amountCents);
      return m;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseAmountToCents(amountStr);
    if (parsedAmount == null) {
      setErrors(['Enter a valid amount.']);
      return;
    }
    const v = validateExpense(parsedAmount, effectivePayments, participants, effectiveShares);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    const payload = {
      payments: effectivePayments.map((p) => ({ ...p })),
      amountCents: parsedAmount,
      description: description.trim(),
      category,
      date,
      participants,
      splitType,
      shares: effectiveShares.map((s) => ({ ...s })),
    };
    if (initial) {
      updateExpense(initial.id, payload);
      toast.show('Expense updated');
    } else {
      addExpense(payload);
      toast.show('Expense added');
    }
    try {
      localStorage.setItem(LAST_CATEGORY_KEY, category);
    } catch {
      /* ignore */
    }
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Amount</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">$</span>
          <input
            type="text"
            inputMode="decimal"
            className="input pl-7 text-2xl font-semibold tabular-nums"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0.00"
            autoFocus
          />
        </div>
      </div>

      <div>
        <label className="label">Who paid?</label>
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => togglePayer(p.id)}
              className={`chip ${payers.includes(p.id) ? 'chip-active' : ''}`}
            >
              {p.name}
            </button>
          ))}
          <AddPersonChip
            onAdded={(id) => {
              // Clicking + in "Who paid?" implicitly selects them as both a
              // payer and a participant for this expense.
              setPayers((cur) => (cur.includes(id) ? cur : [...cur, id]));
              setParticipants((cur) => (cur.includes(id) ? cur : [...cur, id]));
            }}
          />
        </div>

        {payers.length > 1 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                How much did each person pay?
              </span>
              <button
                type="button"
                className="btn-ghost !py-1 !px-2 text-xs"
                onClick={splitPaymentsEvenly}
              >
                Split evenly
              </button>
            </div>
            {payers.map((pid) => {
              const person = people.find((p) => p.id === pid);
              if (!person) return null;
              return (
                <div key={pid} className="flex items-center gap-3">
                  <span className="w-24 text-sm">{person.name}</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input pl-6"
                      value={paymentAmounts[pid] ?? ''}
                      onChange={(e) =>
                        setPaymentAmounts({ ...paymentAmounts, [pid]: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>
              );
            })}
            {amountCents > 0 && (
              <div
                className={`text-xs tabular-nums ${
                  paymentsDelta === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                Payments total ${centsToDollarString(paymentsSum)} of $
                {centsToDollarString(amountCents)} (
                {paymentsDelta === 0
                  ? 'matches'
                  : `${paymentsDelta > 0 ? 'over by' : 'short by'} $${centsToDollarString(
                      Math.abs(paymentsDelta),
                    )}`}
                )
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="label">Date</label>
        <input
          type="date"
          className="input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Description</label>
        <input
          type="text"
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Dinner at Blue Door"
        />
      </div>

      <div>
        <label className="label">Category</label>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setCategory(c)}
              className={`chip ${c === category ? 'chip-active' : ''}`}
            >
              {c}
            </button>
          ))}
          <div className="flex gap-1 items-center">
            <input
              className="input !py-1 !px-2 text-xs w-28"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="New..."
            />
            <button
              type="button"
              className="btn-ghost !px-2 !py-1"
              onClick={() => {
                if (newCategory.trim()) {
                  addCategory(newCategory.trim());
                  setCategory(newCategory.trim());
                  setNewCategory('');
                }
              }}
              aria-label="Add category"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="label">Who participated?</label>
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => toggleParticipant(p.id)}
              className={`chip ${participants.includes(p.id) ? 'chip-active' : ''}`}
            >
              {p.name}
            </button>
          ))}
          <AddPersonChip
            onAdded={(id) =>
              setParticipants((cur) => (cur.includes(id) ? cur : [...cur, id]))
            }
          />
        </div>
      </div>

      <div>
        <label className="label">Split</label>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            className={`chip ${splitType === 'equal' ? 'chip-active' : ''}`}
            onClick={() => setSplitType('equal')}
          >
            Equal
          </button>
          <button
            type="button"
            className={`chip ${splitType === 'custom' ? 'chip-active' : ''}`}
            onClick={() => {
              setSplitType('custom');
              setCustomShares((cur) => {
                const next = { ...cur };
                for (const s of equalShares) {
                  if (!next[s.personId]) next[s.personId] = centsToDollarString(s.amountCents);
                }
                return next;
              });
            }}
          >
            Custom
          </button>
        </div>

        <div className="space-y-2">
          {participants.map((pid) => {
            const person = people.find((p) => p.id === pid);
            if (!person) return null;
            const equal = equalShares.find((s) => s.personId === pid)?.amountCents ?? 0;
            if (splitType === 'equal') {
              return (
                <div
                  key={pid}
                  className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 text-sm"
                >
                  <span>{person.name}</span>
                  <span className="tabular-nums font-medium">
                    ${centsToDollarString(equal)}
                  </span>
                </div>
              );
            }
            return (
              <div key={pid} className="flex items-center gap-3">
                <span className="w-24 text-sm">{person.name}</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input pl-6"
                    value={customShares[pid] ?? ''}
                    onChange={(e) =>
                      setCustomShares({ ...customShares, [pid]: e.target.value })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>

        {splitType === 'custom' && amountCents > 0 && (
          <div
            className={`mt-2 text-xs tabular-nums ${
              sharesDelta === 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            Shares total ${centsToDollarString(sharesSum)} of ${centsToDollarString(amountCents)}{' '}
            ({sharesDelta === 0 ? 'matches' : `${sharesDelta > 0 ? 'over by' : 'short by'} $${centsToDollarString(Math.abs(sharesDelta))}`})
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="text-sm text-rose-600 dark:text-rose-400 space-y-1">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn-primary flex-1">
          {initial ? 'Save changes' : 'Add expense'}
        </button>
      </div>
    </form>
  );
}
