import type { AppState, Transaction } from '../types';
import { calculateEqualShares } from './accounting';
import { DEFAULT_CATEGORIES } from './categories';

export function makeInitialState(): AppState {
  const people = [
    { id: 'p_a', name: 'Armaan', favorite: true },
    { id: 'p_b', name: 'Roohaniat', favorite: true },
    { id: 'p_c', name: 'Sam', favorite: true },
  ];
  const [a, b, c] = people.map((p) => p.id);

  const today = new Date();
  const d = (offset: number) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - offset);
    return dt.toISOString().slice(0, 10);
  };

  const transactions: Transaction[] = [
    {
      id: 'sample_1',
      type: 'expense',
      payments: [{ personId: a, amountCents: 7850 }],
      amountCents: 7850,
      description: 'Pizza night',
      category: 'Food',
      date: d(5),
      participants: [a, b, c],
      splitType: 'equal',
      shares: calculateEqualShares(7850, [a, b, c]),
      createdAt: Date.now() - 5 * 86400000,
    },
    {
      id: 'sample_2',
      type: 'expense',
      payments: [{ personId: b, amountCents: 4200 }],
      amountCents: 4200,
      description: 'Gas on the way to the trail',
      category: 'Gas',
      date: d(4),
      participants: [a, b, c],
      splitType: 'equal',
      shares: calculateEqualShares(4200, [a, b, c]),
      createdAt: Date.now() - 4 * 86400000,
    },
    {
      id: 'sample_3',
      type: 'expense',
      payments: [{ personId: a, amountCents: 12000 }],
      amountCents: 12000,
      description: 'Concert tickets',
      category: 'Tickets',
      date: d(3),
      participants: [a, c],
      splitType: 'equal',
      shares: calculateEqualShares(12000, [a, c]),
      createdAt: Date.now() - 3 * 86400000,
    },
    {
      // Two people chipped in different amounts to cover one expense — the
      // third person (Roohaniat) paid nothing up front but still shares the cost.
      id: 'sample_4',
      type: 'expense',
      payments: [
        { personId: c, amountCents: 3000 },
        { personId: a, amountCents: 2000 },
      ],
      amountCents: 5000,
      description: 'Groceries for the cabin',
      category: 'Food',
      date: d(2),
      participants: [a, b, c],
      splitType: 'equal',
      shares: calculateEqualShares(5000, [a, b, c]),
      createdAt: Date.now() - 2 * 86400000,
    },
    {
      id: 'sample_5',
      type: 'transfer',
      from: c,
      to: a,
      amountCents: 3000,
      date: d(1),
      note: 'Starter payment',
      createdAt: Date.now() - 1 * 86400000,
    },
  ];

  return {
    people,
    transactions,
    categories: [...DEFAULT_CATEGORIES],
    settings: {
      currency: 'CAD',
      dark: false,
      seeded: true,
    },
  };
}

export function makeEmptyState(): AppState {
  return {
    people: [
      { id: 'p_a', name: 'Armaan', favorite: true },
      { id: 'p_b', name: 'Roohaniat', favorite: true },
      { id: 'p_c', name: 'Sam', favorite: true },
    ],
    transactions: [],
    categories: [...DEFAULT_CATEGORIES],
    settings: {
      currency: 'CAD',
      dark: false,
      seeded: false,
    },
  };
}
