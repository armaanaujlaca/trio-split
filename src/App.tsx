import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Cloud,
  CloudOff,
  History as HistoryIcon,
  LayoutDashboard,
  RefreshCw,
  Settings as SettingsIcon,
  Undo2,
  Wallet,
} from 'lucide-react';
import { useStore } from './store/useStore';
import type { SyncStatus } from './store/useStore';
import { Dashboard } from './components/screens/Dashboard';
import { History } from './components/screens/History';
import { Statistics } from './components/screens/Statistics';
import { Settings } from './components/screens/Settings';
import { ToastProvider } from './components/ui/Toast';

type Tab = 'dashboard' | 'history' | 'stats' | 'settings';

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const dark = useStore((s) => s.settings.dark);
  const canUndo = useStore((s) => s._undoStack.length > 0);
  const undo = useStore((s) => s.undo);
  const syncStatus = useStore((s) => s._syncStatus);
  const initSync = useStore((s) => s.initSync);

  useEffect(() => {
    initSync();
  }, [initSync]);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [dark]);

  // Keyboard shortcuts (desktop only)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger inside inputs
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === '1') setTab('dashboard');
      if (e.key === '2') setTab('history');
      if (e.key === '3') setTab('stats');
      if (e.key === '4') setTab('settings');
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo]);

  return (
    <ToastProvider>
      <div className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-base">Trio Split</span>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`btn-ghost text-sm ${
                      tab === t.id
                        ? '!bg-brand-100 dark:!bg-brand-950 !text-brand-700 dark:!text-brand-200'
                        : ''
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1">
              <SyncBadge status={syncStatus} />
              <button
                className="btn-ghost text-sm"
                disabled={!canUndo}
                onClick={undo}
                title="Undo (Ctrl/Cmd+Z)"
              >
                <Undo2 className="w-4 h-4" />
                <span className="hidden sm:inline">Undo</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-5 pb-28 sm:pb-10">
          {tab === 'dashboard' && (
            <Dashboard
              onNavigate={(dest) =>
                setTab(dest === 'history' ? 'history' : 'stats')
              }
            />
          )}
          {tab === 'history' && <History />}
          {tab === 'stats' && <Statistics />}
          {tab === 'settings' && <Settings />}
        </main>

        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 safe-bottom">
          <div className="grid grid-cols-4">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex flex-col items-center justify-center py-2.5 gap-0.5 text-xs ${
                    active
                      ? 'text-brand-600 dark:text-brand-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </ToastProvider>
  );
}

function SyncBadge({ status }: { status: SyncStatus }) {
  // Sync isn't configured for this deployment — don't clutter the header.
  if (status === 'local') return null;

  const config: Record<Exclude<SyncStatus, 'local'>, { icon: typeof Cloud; label: string; cls: string }> = {
    syncing: { icon: RefreshCw, label: 'Syncing…', cls: 'text-slate-400 dark:text-slate-500' },
    synced: { icon: Cloud, label: 'Synced', cls: 'text-emerald-500' },
    offline: { icon: CloudOff, label: 'Offline', cls: 'text-amber-500' },
    error: { icon: AlertTriangle, label: 'Sync error', cls: 'text-rose-500' },
  };
  const { icon: Icon, label, cls } = config[status];

  return (
    <span className={`flex items-center gap-1.5 px-2 text-xs ${cls}`} title={label}>
      <Icon className={`w-4 h-4 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
