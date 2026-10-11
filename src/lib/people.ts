import type { Person, Transaction } from '../types';

/**
 * Returns people with favorites pinned to the front, preserving insertion
 * order within each group. Non-destructive — original array is unchanged.
 */
export function sortPeople(people: Person[]): Person[] {
  const favorites: Person[] = [];
  const others: Person[] = [];
  for (const p of people) {
    if (p.favorite) favorites.push(p);
    else others.push(p);
  }
  return [...favorites, ...others];
}

/**
 * Whether this person appears anywhere in the ledger — any expense payment,
 * share, participant list, or transfer side. Used to decide whether removing
 * them would strand historical records.
 */
export function personHasHistory(personId: string, transactions: Transaction[]): boolean {
  for (const t of transactions) {
    if (t.type === 'expense') {
      if (t.participants.includes(personId)) return true;
      if (t.payments.some((p) => p.personId === personId)) return true;
      if (t.shares.some((s) => s.personId === personId)) return true;
    } else if (t.from === personId || t.to === personId) {
      return true;
    }
  }
  return false;
}
