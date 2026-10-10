import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { formatCurrency, formatDate, formatPayerSummary } from '../../lib/format';
import type { Expense, Transaction, Transfer } from '../../types';
import {
  ArrowRight,
  Copy as CopyIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  Receipt,
  Send,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ExpenseForm } from '../forms/ExpenseForm';
import { TransferForm } from '../forms/TransferForm';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

type DateFilter = 'all' | 'month' | 'last-month' | 'year' | 'custom';
type SortMode = 'newest' | 'oldest' | 'largest' | 'smallest';
type TypeFilter = 'all' | 'expense' | 'transfer';

function inRange(iso: string, filter: DateFilter, custom: { start: string; end: string }): boolean {
  if (filter === 'all') return true;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return true;
  const date = new Date(y, m - 1, d);
  const now = new Date();
  if (filter === 'month') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  if (filter === 'last-month') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return date.getFullYear() === lm.getFullYear() && date.getMonth() === lm.getMonth();
  }
  if (filter === 'year') {
    return date.getFullYear() === now.getFullYear();
  }
  if (filter === 'custom') {
    if (custom.start && iso < custom.start) return false;
    if (custom.end && iso > custom.end) return false;
    return true;
  }
  return true;
}

export function History() {
  const transactions = useStore((s) => s.transactions);
  const people = useStore((s) => s.people);
  const currency = useStore((s) => s.settings.currency);
  const deleteTransaction = useStore((s) => s.deleteTransaction);
  const duplicateTransaction = useStore((s) => s.duplicateTransaction);
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [sort, setSort] = useState<SortMode>('newest');

  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editTransfer, setEditTransfer] = useState<Transfer | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [addKind, setAddKind] = useState<'expense' | 'transfer' | null>(null);

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = transactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (!inRange(t.date, dateFilter, custom)) return false;
      if (!q) return true;
      if (t.type === 'expense') {
        return (
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
        );
      }
      return (
        t.note.toLowerCase().includes(q) ||
        nameOf(t.from).toLowerCase().includes(q) ||
        nameOf(t.to).toLowerCase().includes(q)
      );
    });
    const sorter: Record<SortMode, (a: Transaction, b: Transaction) => number> = {
      newest: (a, b) => b.createdAt - a.createdAt,
      oldest: (a, b) => a.createdAt - b.createdAt,
      largest: (a, b) => b.amountCents - a.amountCents,
      smallest: (a, b) => a.amountCents - b.amountCents,
    };
    return [...items].sort(sorter[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, query, typeFilter, dateFilter, custom.start, custom.end, sort]);

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search descriptions, categories, notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'expense', 'transfer'] as TypeFilter[]).map((v) => (
            <button
              key={v}
              onClick={() => setTypeFilter(v)}
              className={`chip ${typeFilter === v ? 'chip-active' : ''}`}
            >
              {v === 'all' ? 'All' : v === 'expense' ? 'Expenses' : 'Repayments'}
            </button>
          ))}
          <div className="ml-auto flex gap-2 flex-wrap">
            <select
              className="chip pr-7 appearance-none bg-no-repeat bg-right"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            >
              <option value="all">All time</option>
              <option value="month">This month</option>
              <option value="last-month">Last month</option>
              <option value="year">This year</option>
              <option value="custom">Custom</option>
            </select>
            <select
              className="chip pr-7 appearance-none bg-no-repeat bg-right"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="largest">Largest</option>
              <option value="smallest">Smallest</option>
            </select>
          </div>
        </div>
        {dateFilter === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="input"
              value={custom.start}
              onChange={(e) => setCustom({ ...custom, start: e.target.value })}
            />
            <input
              type="date"
              className="input"
              value={custom.end}
              onChange={(e) => setCustom({ ...custom, end: e.target.value })}
            />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={() => setAddKind('expense')}>
          <Receipt className="w-4 h-4" /> Add expense
        </button>
        <button className="btn-secondary flex-1" onClick={() => setAddKind('transfer')}>
          <Send className="w-4 h-4" /> Add repayment
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <Plus className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No transactions match these filters.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.id} className="card p-4">
              {t.type === 'expense' ? (
                <ExpenseRow
                  tx={t}
                  nameOf={nameOf}
                  currency={currency}
                  onEdit={() => setEditExpense(t)}
                  onDuplicate={() => {
                    duplicateTransaction(t.id);
                    toast.show('Expense duplicated');
                  }}
                  onDelete={() => setDeleting(t)}
                />
              ) : (
                <TransferRow
                  tx={t}
                  nameOf={nameOf}
                  currency={currency}
                  onEdit={() => setEditTransfer(t)}
                  onDuplicate={() => {
                    duplicateTransaction(t.id);
                    toast.show('Repayment duplicated');
                  }}
                  onDelete={() => setDeleting(t)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!editExpense}
        onClose={() => setEditExpense(null)}
        title="Edit expense"
        size="lg"
      >
        {editExpense && (
          <ExpenseForm initial={editExpense} onDone={() => setEditExpense(null)} />
        )}
      </Modal>
      <Modal
        open={!!editTransfer}
        onClose={() => setEditTransfer(null)}
        title="Edit repayment"
      >
        {editTransfer && (
          <TransferForm initial={editTransfer} onDone={() => setEditTransfer(null)} />
        )}
      </Modal>
      <Modal
        open={addKind === 'expense'}
        onClose={() => setAddKind(null)}
        title="Add expense"
        size="lg"
      >
        <ExpenseForm onDone={() => setAddKind(null)} />
      </Modal>
      <Modal open={addKind === 'transfer'} onClose={() => setAddKind(null)} title="Add repayment">
        <TransferForm onDone={() => setAddKind(null)} />
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        title="Delete this transaction?"
        description="You can undo this from the toast or restore it from Settings."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            const target = deleting;
            deleteTransaction(target.id);
            toast.show('Transaction deleted', {
              action: {
                label: 'Undo',
                onClick: () => useStore.getState().undo(),
              },
            });
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}

interface RowProps<T extends Transaction> {
  tx: T;
  nameOf: (id: string) => string;
  currency: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function ExpenseRow({ tx, nameOf, currency, onEdit, onDuplicate, onDelete }: RowProps<Expense>) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="chip">{tx.category}</span>
            <span className="font-semibold truncate">
              {tx.description || 'Untitled expense'}
            </span>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {formatPayerSummary(tx.payments, nameOf, currency)}
            </span>{' '}
            · {formatDate(tx.date)} ·{' '}
            {tx.participants.length} participant{tx.participants.length === 1 ? '' : 's'}{' '}
            · {tx.splitType === 'equal' ? 'equal split' : 'custom split'}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-bold tabular-nums text-lg">
            {formatCurrency(tx.amountCents, currency)}
          </div>
        </div>
      </div>
      <div className="flex gap-1 mt-3 justify-end">
        <button className="btn-ghost !py-1 text-xs" onClick={onDuplicate}>
          <CopyIcon className="w-3.5 h-3.5" />
          Duplicate
        </button>
        <button className="btn-ghost !py-1 text-xs" onClick={onEdit}>
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          className="btn-ghost !py-1 text-xs text-rose-600 dark:text-rose-400"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}

function TransferRow({ tx, nameOf, currency, onEdit, onDuplicate, onDelete }: RowProps<Transfer>) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-semibold flex-wrap">
            <span className="chip">Repayment</span>
            <span>
              {nameOf(tx.from)} <ArrowRight className="inline w-3.5 h-3.5" /> {nameOf(tx.to)}
            </span>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {formatDate(tx.date)}
            {tx.note && ` · ${tx.note}`}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-bold tabular-nums text-lg">
            {formatCurrency(tx.amountCents, currency)}
          </div>
        </div>
      </div>
      <div className="flex gap-1 mt-3 justify-end">
        <button className="btn-ghost !py-1 text-xs" onClick={onDuplicate}>
          <CopyIcon className="w-3.5 h-3.5" />
          Duplicate
        </button>
        <button className="btn-ghost !py-1 text-xs" onClick={onEdit}>
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          className="btn-ghost !py-1 text-xs text-rose-600 dark:text-rose-400"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}
