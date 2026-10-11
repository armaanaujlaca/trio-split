import type { AppState } from '../types';

const KEY = 'trio-split:v1';

/**
 * Migrate older saved shapes to the current one.
 *  - v1 expenses had a single `paidBy: PersonId` field; they're now stored as
 *    `payments: { personId, amountCents }[]` so an expense can have multiple payers.
 *  - People didn't have a `favorite` flag; the original three ids (p_a/b/c) are
 *    backfilled as favorites so existing synced data keeps the expected ordering.
 */
export function migrateState(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const s = raw as Record<string, unknown>;

  const transactions = Array.isArray(s.transactions)
    ? s.transactions.map((t) => {
        if (
          t &&
          typeof t === 'object' &&
          (t as Record<string, unknown>).type === 'expense' &&
          !Array.isArray((t as Record<string, unknown>).payments) &&
          typeof (t as Record<string, unknown>).paidBy === 'string'
        ) {
          const rec = t as Record<string, unknown>;
          const { paidBy, ...rest } = rec;
          return {
            ...rest,
            payments: [{ personId: paidBy, amountCents: rec.amountCents }],
          };
        }
        return t;
      })
    : s.transactions;

  const LEGACY_FAVORITE_IDS = new Set(['p_a', 'p_b', 'p_c']);
  const people = Array.isArray(s.people)
    ? s.people.map((p) => {
        if (p && typeof p === 'object') {
          const rec = p as Record<string, unknown>;
          if (rec.favorite === undefined && typeof rec.id === 'string' && LEGACY_FAVORITE_IDS.has(rec.id)) {
            return { ...rec, favorite: true };
          }
        }
        return p;
      })
    : s.people;

  return { ...s, people, transactions };
}

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = migrateState(JSON.parse(raw));
    if (!isValidState(parsed)) return null;
    return parsed as AppState;
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to save state', err);
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function isValidState(x: unknown): x is AppState {
  const migrated = migrateState(x);
  if (!migrated || typeof migrated !== 'object') return false;
  const s = migrated as Partial<AppState>;
  if (!Array.isArray(s.people)) return false;
  if (!Array.isArray(s.transactions)) return false;
  if (!Array.isArray(s.categories)) return false;
  if (!s.settings || typeof s.settings !== 'object') return false;

  for (const p of s.people) {
    if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') return false;
  }
  for (const t of s.transactions) {
    if (!t || typeof t.id !== 'string') return false;
    if (t.type === 'expense') {
      if (
        !Array.isArray(t.payments) ||
        t.payments.length === 0 ||
        typeof t.amountCents !== 'number' ||
        !Array.isArray(t.participants) ||
        !Array.isArray(t.shares)
      ) {
        return false;
      }
      for (const payment of t.payments) {
        if (!payment || typeof payment.personId !== 'string' || typeof payment.amountCents !== 'number') {
          return false;
        }
      }
    } else if (t.type === 'transfer') {
      if (
        typeof t.from !== 'string' ||
        typeof t.to !== 'string' ||
        typeof t.amountCents !== 'number'
      ) {
        return false;
      }
    } else {
      return false;
    }
  }
  return true;
}
