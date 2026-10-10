import { useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useToast } from '../ui/Toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  AlertTriangle,
  Download,
  FileDown,
  Moon,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/format';
import { isValidState, migrateState } from '../../lib/storage';

export function Settings() {
  const people = useStore((s) => s.people);
  const renamePerson = useStore((s) => s.renamePerson);
  const dark = useStore((s) => s.settings.dark);
  const seeded = useStore((s) => s.settings.seeded);
  const currency = useStore((s) => s.settings.currency);
  const setDark = useStore((s) => s.setDark);
  const resetAll = useStore((s) => s.resetAll);
  const clearSamples = useStore((s) => s.clearSamples);
  const importState = useStore((s) => s.importState);
  const toast = useToast();

  const trash = useStore((s) => s._trash);
  const restoreFromTrash = useStore((s) => s.restoreFromTrash);
  const transactions = useStore((s) => s.transactions);

  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const state = {
      people,
      transactions,
      categories: useStore.getState().categories,
      settings: useStore.getState().settings,
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trio-split-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show('Exported JSON');
  };

  const exportCSV = () => {
    const rows: string[] = ['type,date,amount,description/note,category,payers,to,participants,shares'];
    const esc = (s: string | undefined) =>
      `"${String(s ?? '').replace(/"/g, '""')}"`;
    for (const t of transactions) {
      if (t.type === 'expense') {
        rows.push(
          [
            'expense',
            t.date,
            (t.amountCents / 100).toFixed(2),
            esc(t.description),
            esc(t.category),
            esc(
              t.payments
                .map(
                  (pay) =>
                    `${people.find((p) => p.id === pay.personId)?.name}:${(
                      pay.amountCents / 100
                    ).toFixed(2)}`,
                )
                .join('; '),
            ),
            '',
            esc(
              t.participants
                .map((pid) => people.find((p) => p.id === pid)?.name)
                .filter(Boolean)
                .join('; '),
            ),
            esc(
              t.shares
                .map(
                  (s) =>
                    `${people.find((p) => p.id === s.personId)?.name}:${(
                      s.amountCents / 100
                    ).toFixed(2)}`,
                )
                .join('; '),
            ),
          ].join(','),
        );
      } else {
        rows.push(
          [
            'transfer',
            t.date,
            (t.amountCents / 100).toFixed(2),
            esc(t.note),
            '',
            esc(people.find((p) => p.id === t.from)?.name),
            esc(people.find((p) => p.id === t.to)?.name),
            '',
            '',
          ].join(','),
        );
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trio-split-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show('Exported CSV');
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = migrateState(JSON.parse(String(reader.result)));
        if (!isValidState(parsed)) {
          toast.show('That file is not a valid export', { variant: 'error' });
          return;
        }
        importState(parsed);
        toast.show('Data imported');
      } catch {
        toast.show('Could not read that file', { variant: 'error' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h3 className="text-base font-semibold mb-3">People</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          Rename the three people to match your group.
        </p>
        <div className="space-y-2">
          {people.map((p) => (
            <input
              key={p.id}
              className="input"
              value={p.name}
              onChange={(e) => renamePerson(p.id, e.target.value)}
            />
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h3 className="text-base font-semibold mb-3">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Dark mode</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Switch to a darker theme.
            </div>
          </div>
          <button
            className={`btn ${dark ? 'btn-primary' : 'btn-secondary'} !px-3 !py-2`}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {dark ? 'Light' : 'Dark'}
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="text-base font-semibold mb-3">Data</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button className="btn-secondary justify-start" onClick={exportJSON}>
            <Download className="w-4 h-4" />
            Export JSON
          </button>
          <button className="btn-secondary justify-start" onClick={exportCSV}>
            <FileDown className="w-4 h-4" />
            Export CSV
          </button>
          <button className="btn-secondary justify-start" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4" />
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importJSON(file);
              e.target.value = '';
            }}
          />
          {seeded && (
            <button className="btn-secondary justify-start" onClick={clearSamples}>
              <Trash2 className="w-4 h-4" />
              Clear sample data
            </button>
          )}
          <button
            className="btn-danger justify-start sm:col-span-2"
            onClick={() => setConfirmReset(true)}
          >
            <AlertTriangle className="w-4 h-4" />
            Reset everything
          </button>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-3">
          Currency: {currency}. Data lives in your browser's localStorage.
        </div>
      </section>

      {trash.length > 0 && (
        <section className="card p-5">
          <h3 className="text-base font-semibold mb-3">Recently deleted</h3>
          <ul className="space-y-2">
            {trash.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {t.type === 'expense'
                      ? t.description || t.category
                      : `${people.find((p) => p.id === t.from)?.name} → ${
                          people.find((p) => p.id === t.to)?.name
                        }`}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {formatCurrency(t.amountCents, currency)} · {formatDate(t.date)}
                  </div>
                </div>
                <button
                  className="btn-ghost !py-1 text-xs"
                  onClick={() => {
                    restoreFromTrash(t.id);
                    toast.show('Restored');
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={confirmReset}
        danger
        title="Delete all your data?"
        description="This permanently clears every expense, repayment, and category. You can't undo this."
        confirmLabel="Yes, reset everything"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetAll();
          setConfirmReset(false);
          toast.show('All data reset');
        }}
      />
    </div>
  );
}
