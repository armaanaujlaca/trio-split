import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { validateTransfer } from '../../lib/accounting';
import { centsToDollarString, parseAmountToCents, todayISO } from '../../lib/format';
import { useToast } from '../ui/Toast';
import type { PersonId, Transfer } from '../../types';
import { ArrowRight, ArrowLeftRight } from 'lucide-react';

interface Props {
  initial?: Transfer;
  onDone: () => void;
  defaults?: { from?: PersonId; to?: PersonId; amountCents?: number };
}

export function TransferForm({ initial, onDone, defaults }: Props) {
  const people = useStore((s) => s.people);
  const addTransfer = useStore((s) => s.addTransfer);
  const updateTransfer = useStore((s) => s.updateTransfer);
  const toast = useToast();

  const [from, setFrom] = useState<PersonId>(
    initial?.from ?? defaults?.from ?? people[0]?.id ?? '',
  );
  const [to, setTo] = useState<PersonId>(
    initial?.to ?? defaults?.to ?? people[1]?.id ?? '',
  );
  const [amountStr, setAmountStr] = useState<string>(
    initial
      ? centsToDollarString(initial.amountCents)
      : defaults?.amountCents
        ? centsToDollarString(defaults.amountCents)
        : '',
  );
  const [date, setDate] = useState<string>(initial?.date ?? todayISO());
  const [note, setNote] = useState<string>(initial?.note ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseAmountToCents(amountStr);
    if (parsedAmount == null) {
      setErrors(['Enter a valid amount.']);
      return;
    }
    const v = validateTransfer(parsedAmount, from, to);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    const payload = {
      from,
      to,
      amountCents: parsedAmount,
      date,
      note: note.trim(),
    };
    if (initial) {
      updateTransfer(initial.id, payload);
      toast.show('Repayment updated');
    } else {
      addTransfer(payload);
      toast.show('Repayment recorded');
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

      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
        <div>
          <label className="label">From</label>
          <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={swap}
          className="btn-ghost p-2 self-end mb-1"
          aria-label="Swap direction"
          title="Swap"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>
        <div>
          <label className="label">To</label>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl py-3">
        <span className="font-medium">{people.find((p) => p.id === from)?.name ?? '—'}</span>
        <ArrowRight className="w-4 h-4 mx-2" />
        <span className="font-medium">{people.find((p) => p.id === to)?.name ?? '—'}</span>
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
        <label className="label">Note (optional)</label>
        <input
          type="text"
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. for groceries"
        />
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
          {initial ? 'Save changes' : 'Record payment'}
        </button>
      </div>
    </form>
  );
}
