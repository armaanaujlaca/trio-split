import { create } from 'zustand';
import type { AppState, Expense, Person, Transaction, Transfer } from '../types';
import { loadState, saveState } from '../lib/storage';
import { makeEmptyState, makeInitialState } from '../lib/sample';
import { newId } from '../lib/id';
import { calculateBalances } from '../lib/accounting';
import { calculateSettlement } from '../lib/settlement';
import { personHasHistory } from '../lib/people';
import {
  fetchRemoteState,
  mergeStates,
  pushRemoteState,
  subscribeRemoteState,
  supabaseEnabled,
} from '../lib/sync';

interface UndoEntry {
  label: string;
  prev: AppState;
}

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error';

interface StoreState extends AppState {
  _undoStack: UndoEntry[];
  _trash: Transaction[];
  _syncStatus: SyncStatus;
  _lastKnownUpdatedAt: string | null;

  // Mutators
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'type'>) => Expense;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  addTransfer: (transfer: Omit<Transfer, 'id' | 'createdAt' | 'type'>) => Transfer;
  updateTransfer: (id: string, patch: Partial<Transfer>) => void;
  deleteTransaction: (id: string) => void;
  duplicateTransaction: (id: string) => void;
  restoreFromTrash: (id: string) => void;

  renamePerson: (id: string, name: string) => void;
  addPerson: (name: string, options?: { favorite?: boolean }) => Person | null;
  removePerson: (id: string) => { ok: boolean; reason?: 'has_history' | 'last_person' };
  togglePersonFavorite: (id: string) => void;
  addCategory: (name: string) => void;
  removeCategory: (name: string) => void;
  settleAll: () => Transfer[];
  resetAll: () => void;
  clearSamples: () => void;
  importState: (state: AppState) => void;
  setDark: (dark: boolean) => void;

  undo: () => void;
  canUndo: () => boolean;

  /** Connect to Supabase (no-op if VITE_SUPABASE_* env vars aren't set). */
  initSync: () => void;
}

function initial(): AppState {
  const stored = loadState();
  if (stored) return stored;
  return makeInitialState();
}

/** Snapshot of only the persisted parts (not undo/trash/sync bookkeeping). */
function persistable(state: StoreState): AppState {
  return {
    people: state.people,
    transactions: state.transactions,
    categories: state.categories,
    settings: state.settings,
  };
}

function withUndo(
  label: string,
  state: StoreState,
  mutate: (draft: AppState) => AppState,
): Partial<StoreState> {
  const prev = persistable(state);
  const next = mutate(prev);
  const undo = [...state._undoStack, { label, prev }].slice(-20);
  saveState(next);
  schedulePush(next);
  return { ...next, _undoStack: undo };
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let syncStarted = false;

/** Debounced, conflict-safe push to Supabase. No-op when sync isn't configured. */
function schedulePush(state: AppState) {
  if (!supabaseEnabled) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushNow(state);
  }, 500);
}

async function pushNow(state: AppState, attempt = 0): Promise<void> {
  useStore.setState({ _syncStatus: 'syncing' });
  const result = await pushRemoteState(state, useStore.getState()._lastKnownUpdatedAt);

  if (result.ok) {
    useStore.setState({ _syncStatus: 'synced', _lastKnownUpdatedAt: result.updatedAt });
    return;
  }

  if (result.reason === 'conflict' && attempt < 2) {
    // Someone else wrote first. Pull their version, merge it with whatever
    // the user has done locally since (don't lose either side), and retry.
    const remote = await fetchRemoteState();
    if (!remote) {
      useStore.setState({ _syncStatus: 'offline' });
      return;
    }
    const current = persistable(useStore.getState());
    const merged = mergeStates(current, remote.data);
    saveState(merged);
    useStore.setState({ ...merged, _lastKnownUpdatedAt: remote.updatedAt });
    await pushNow(merged, attempt + 1);
    return;
  }

  useStore.setState({ _syncStatus: result.reason === 'conflict' ? 'error' : 'offline' });
}

export const useStore = create<StoreState>((set, get) => ({
  ...initial(),
  _undoStack: [],
  _trash: [],
  _syncStatus: supabaseEnabled ? 'syncing' : 'local',
  _lastKnownUpdatedAt: null,

  addExpense: (data) => {
    const expense: Expense = { ...data, id: newId('exp'), createdAt: Date.now(), type: 'expense' };
    set((state) =>
      withUndo('Add expense', state, (draft) => ({
        ...draft,
        transactions: [...draft.transactions, expense],
      })),
    );
    return expense;
  },

  updateExpense: (id, patch) => {
    set((state) =>
      withUndo('Edit expense', state, (draft) => ({
        ...draft,
        transactions: draft.transactions.map((t) =>
          t.id === id && t.type === 'expense' ? ({ ...t, ...patch, type: 'expense' } as Expense) : t,
        ),
      })),
    );
  },

  addTransfer: (data) => {
    const transfer: Transfer = { ...data, id: newId('tr'), createdAt: Date.now(), type: 'transfer' };
    set((state) =>
      withUndo('Add repayment', state, (draft) => ({
        ...draft,
        transactions: [...draft.transactions, transfer],
      })),
    );
    return transfer;
  },

  updateTransfer: (id, patch) => {
    set((state) =>
      withUndo('Edit repayment', state, (draft) => ({
        ...draft,
        transactions: draft.transactions.map((t) =>
          t.id === id && t.type === 'transfer' ? ({ ...t, ...patch, type: 'transfer' } as Transfer) : t,
        ),
      })),
    );
  },

  deleteTransaction: (id) => {
    set((state) => {
      const target = state.transactions.find((t) => t.id === id);
      const trash = target ? [...state._trash, target].slice(-20) : state._trash;
      const update = withUndo('Delete transaction', state, (draft) => ({
        ...draft,
        transactions: draft.transactions.filter((t) => t.id !== id),
      }));
      return { ...update, _trash: trash };
    });
  },

  duplicateTransaction: (id) => {
    const original = get().transactions.find((t) => t.id === id);
    if (!original) return;
    const copy: Transaction =
      original.type === 'expense'
        ? { ...original, id: newId('exp'), createdAt: Date.now() }
        : { ...original, id: newId('tr'), createdAt: Date.now() };
    set((state) =>
      withUndo('Duplicate', state, (draft) => ({
        ...draft,
        transactions: [...draft.transactions, copy],
      })),
    );
  },

  restoreFromTrash: (id) => {
    const state = get();
    const target = state._trash.find((t) => t.id === id);
    if (!target) return;
    set((s) => {
      const trash = s._trash.filter((t) => t.id !== id);
      const update = withUndo('Restore', s, (draft) => ({
        ...draft,
        transactions: [...draft.transactions, target],
      }));
      return { ...update, _trash: trash };
    });
  },

  renamePerson: (id, name) => {
    set((state) =>
      withUndo('Rename person', state, (draft) => ({
        ...draft,
        people: draft.people.map((p: Person) => (p.id === id ? { ...p, name } : p)),
      })),
    );
  },

  addPerson: (name, options) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    // Reject duplicates (case-insensitive) so adding the same person twice
    // doesn't fracture their balance across two ids.
    const existing = get().people.find(
      (p) => p.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;
    const person: Person = { id: newId('person'), name: trimmed };
    if (options?.favorite) person.favorite = true;
    set((state) =>
      withUndo('Add person', state, (draft) => ({
        ...draft,
        people: [...draft.people, person],
      })),
    );
    return person;
  },

  removePerson: (id) => {
    const state = get();
    if (state.people.length <= 1) return { ok: false, reason: 'last_person' };
    if (personHasHistory(id, state.transactions)) {
      return { ok: false, reason: 'has_history' };
    }
    set((s) =>
      withUndo('Remove person', s, (draft) => ({
        ...draft,
        people: draft.people.filter((p) => p.id !== id),
      })),
    );
    return { ok: true };
  },

  togglePersonFavorite: (id) => {
    set((state) =>
      withUndo('Toggle favorite', state, (draft) => ({
        ...draft,
        people: draft.people.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)),
      })),
    );
  },

  addCategory: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((state) => {
      if (state.categories.includes(trimmed)) return {} as Partial<StoreState>;
      return withUndo('Add category', state, (draft) => ({
        ...draft,
        categories: [...draft.categories, trimmed],
      }));
    });
  },

  removeCategory: (name) => {
    set((state) =>
      withUndo('Remove category', state, (draft) => ({
        ...draft,
        categories: draft.categories.filter((c) => c !== name),
      })),
    );
  },

  settleAll: () => {
    const state = get();
    const balances = calculateBalances(
      state.people.map((p) => p.id),
      state.transactions,
    );
    const payments = calculateSettlement(balances);
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const transfers: Transfer[] = payments.map((p) => ({
      id: newId('tr'),
      type: 'transfer',
      from: p.from,
      to: p.to,
      amountCents: p.amountCents,
      date: today,
      note: 'Settle all',
      createdAt: now,
    }));
    if (transfers.length === 0) return [];
    set((s) =>
      withUndo('Settle all', s, (draft) => ({
        ...draft,
        transactions: [...draft.transactions, ...transfers],
      })),
    );
    return transfers;
  },

  resetAll: () => {
    const empty = makeEmptyState();
    saveState(empty);
    schedulePush(empty);
    set({ ...empty, _undoStack: [], _trash: [] });
  },

  clearSamples: () => {
    set((state) =>
      withUndo('Clear sample data', state, (draft) => ({
        ...draft,
        transactions: [],
        settings: { ...draft.settings, seeded: false },
      })),
    );
  },

  importState: (next) => {
    set((state) => {
      const update = withUndo('Import data', state, () => next);
      return { ...update, _trash: [] };
    });
  },

  setDark: (dark) => {
    set((state) =>
      withUndo('Toggle theme', state, (draft) => ({
        ...draft,
        settings: { ...draft.settings, dark },
      })),
    );
  },

  undo: () => {
    const stack = get()._undoStack;
    if (stack.length === 0) return;
    const last = stack[stack.length - 1];
    saveState(last.prev);
    schedulePush(last.prev);
    set({ ...last.prev, _undoStack: stack.slice(0, -1) });
  },

  canUndo: () => get()._undoStack.length > 0,

  initSync: () => {
    if (!supabaseEnabled || syncStarted) return;
    syncStarted = true;

    void (async () => {
      set({ _syncStatus: 'syncing' });
      const remote = await fetchRemoteState();
      const local = persistable(get());

      if (!remote) {
        // First time this household has ever synced — seed the row.
        const result = await pushRemoteState(local, null);
        if (result.ok) {
          set({ _syncStatus: 'synced', _lastKnownUpdatedAt: result.updatedAt });
        } else {
          set({ _syncStatus: 'offline' });
        }
      } else {
        // Reconcile whatever's in this browser with the shared copy so
        // neither side silently loses data, then push the merged result.
        const merged = mergeStates(local, remote.data);
        saveState(merged);
        set({ ...merged, _lastKnownUpdatedAt: remote.updatedAt });
        await pushNow(merged);
      }

      subscribeRemoteState((row) => {
        // Ignore the echo of our own writes.
        if (row.updatedAt === useStore.getState()._lastKnownUpdatedAt) return;
        const current = persistable(useStore.getState());
        const merged = mergeStates(current, row.data);
        saveState(merged);
        set({ ...merged, _lastKnownUpdatedAt: row.updatedAt, _syncStatus: 'synced' });
      });
    })();

    window.addEventListener('online', () => {
      const state = useStore.getState();
      if (state._syncStatus === 'offline') void pushNow(persistable(state));
    });
  },
}));
