import { describe, it, expect } from 'vitest';
import {
  calculateBalances,
  calculateEqualShares,
  calculateExpenseShares,
  makeEqualExpense,
  perPersonStats,
  sumShares,
  validateExpense,
  validateExpensePayments,
  validateTransfer,
} from '../accounting';
import { calculateSettlement } from '../settlement';
import type { Transaction } from '../../types';

const A = 'a';
const B = 'b';
const C = 'c';
const PEOPLE = [A, B, C];

describe('calculateEqualShares', () => {
  it('splits evenly when it divides', () => {
    expect(calculateEqualShares(15000, [A, B, C])).toEqual([
      { personId: A, amountCents: 5000 },
      { personId: B, amountCents: 5000 },
      { personId: C, amountCents: 5000 },
    ]);
  });

  it('distributes leftover cents without losing a penny', () => {
    const shares = calculateEqualShares(1000, [A, B, C]); // $10 / 3
    expect(sumShares(shares)).toBe(1000);
    // first participants get the extra cent
    expect(shares[0].amountCents).toBe(334);
    expect(shares[1].amountCents).toBe(333);
    expect(shares[2].amountCents).toBe(333);
  });

  it('handles a single participant', () => {
    expect(calculateEqualShares(500, [A])).toEqual([{ personId: A, amountCents: 500 }]);
  });
});

describe('calculateBalances', () => {
  it('Example 1: A pays $150, equal split', () => {
    const tx: Transaction[] = [
      makeEqualExpense({
        id: '1',
        paidBy: A,
        amountCents: 15000,
        date: '2024-01-01',
        participants: PEOPLE,
      }),
    ];
    expect(calculateBalances(PEOPLE, tx)).toEqual({ a: 10000, b: -5000, c: -5000 });
  });

  it('Example 2: A pays $150, B and C each repay $50 → all zero', () => {
    const tx: Transaction[] = [
      makeEqualExpense({
        id: '1',
        paidBy: A,
        amountCents: 15000,
        date: '2024-01-01',
        participants: PEOPLE,
      }),
      {
        id: '2',
        type: 'transfer',
        from: B,
        to: A,
        amountCents: 5000,
        date: '2024-01-02',
        note: '',
        createdAt: 2,
      },
      {
        id: '3',
        type: 'transfer',
        from: C,
        to: A,
        amountCents: 5000,
        date: '2024-01-02',
        note: '',
        createdAt: 3,
      },
    ];
    expect(calculateBalances(PEOPLE, tx)).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('Example 3: A pays $100, split only between A and B', () => {
    const tx: Transaction[] = [
      makeEqualExpense({
        id: '1',
        paidBy: A,
        amountCents: 10000,
        date: '2024-01-01',
        participants: [A, B],
      }),
    ];
    expect(calculateBalances(PEOPLE, tx)).toEqual({ a: 5000, b: -5000, c: 0 });
  });

  it('Example 4: A pays $300, custom split 50/100/150', () => {
    const expense: Transaction = {
      id: '1',
      type: 'expense',
      payments: [{ personId: A, amountCents: 30000 }],
      amountCents: 30000,
      description: 'dinner',
      category: 'Food',
      date: '2024-01-01',
      participants: PEOPLE,
      splitType: 'custom',
      shares: [
        { personId: A, amountCents: 5000 },
        { personId: B, amountCents: 10000 },
        { personId: C, amountCents: 15000 },
      ],
      createdAt: 1,
    };
    expect(calculateBalances(PEOPLE, [expense])).toEqual({ a: 25000, b: -10000, c: -15000 });
  });

  it('Example 5: multiple payers with different splits still balance', () => {
    const tx: Transaction[] = [
      makeEqualExpense({ id: '1', paidBy: A, amountCents: 15000, date: 'd', participants: PEOPLE }),
      makeEqualExpense({ id: '2', paidBy: B, amountCents: 9000, date: 'd', participants: PEOPLE }),
      makeEqualExpense({ id: '3', paidBy: C, amountCents: 6000, date: 'd', participants: PEOPLE }),
    ];
    const bals = calculateBalances(PEOPLE, tx);
    const sum = Object.values(bals).reduce((s, x) => s + x, 0);
    expect(sum).toBe(0);
    // A: paid 15000, consumed 10000 → +5000
    expect(bals[A]).toBe(5000);
    // B: paid 9000, consumed 10000 → -1000
    expect(bals[B]).toBe(-1000);
    // C: paid 6000, consumed 10000 → -4000
    expect(bals[C]).toBe(-4000);
  });

  it('direction of transfer: A→B $20 shifts $20 of debt', () => {
    const base = makeEqualExpense({
      id: '1',
      paidBy: A,
      amountCents: 15000,
      date: 'd',
      participants: PEOPLE,
    });
    const tx: Transaction[] = [
      base,
      {
        id: '2',
        type: 'transfer',
        from: A,
        to: B,
        amountCents: 2000,
        date: 'd',
        note: '',
        createdAt: 2,
      },
    ];
    const b = calculateBalances(PEOPLE, tx);
    // Base: A+100, B-50, C-50. Then A→B $20 adds +20 to A and -20 to B.
    expect(b).toEqual({ a: 12000, b: -7000, c: -5000 });
    expect(b.a + b.b + b.c).toBe(0);
  });
});

describe('calculateSettlement', () => {
  it('simplifies 3 debtors onto 1 creditor', () => {
    const bals = { a: 10000, b: -5000, c: -5000 };
    const pays = calculateSettlement(bals);
    expect(pays).toHaveLength(2);
    const forA = pays.filter((p) => p.to === 'a');
    expect(forA.reduce((s, p) => s + p.amountCents, 0)).toBe(10000);
  });

  it('Example from spec: A+100, B+50, C-150 → C pays A and B', () => {
    const pays = calculateSettlement({ a: 10000, b: 5000, c: -15000 });
    const byPair = new Map(pays.map((p) => [`${p.from}->${p.to}`, p.amountCents]));
    expect(byPair.get('c->a')).toBe(10000);
    expect(byPair.get('c->b')).toBe(5000);
    expect(pays).toHaveLength(2);
  });

  it('A+250, B-100, C-150', () => {
    const pays = calculateSettlement({ a: 25000, b: -10000, c: -15000 });
    const byPair = new Map(pays.map((p) => [`${p.from}->${p.to}`, p.amountCents]));
    expect(byPair.get('c->a')).toBe(15000);
    expect(byPair.get('b->a')).toBe(10000);
  });

  it('returns no payments when everyone is zero', () => {
    expect(calculateSettlement({ a: 0, b: 0, c: 0 })).toEqual([]);
  });

  it('handles multi-creditor multi-debtor correctly (sum conserved)', () => {
    const bals: Record<string, number> = { a: 7000, b: 3000, c: -4000, d: -6000 };
    const pays = calculateSettlement(bals);
    const totalPaid = pays.reduce((s, p) => s + p.amountCents, 0);
    expect(totalPaid).toBe(10000); // = sum of positive balances
    // Everyone zeros out
    const residual = { ...bals };
    for (const p of pays) {
      residual[p.from] += p.amountCents;
      residual[p.to] -= p.amountCents;
    }
    for (const v of Object.values(residual)) expect(v).toBe(0);
  });
});

describe('validation', () => {
  it('rejects a custom split whose shares don\'t sum to total', () => {
    const v = validateExpense(
      10000,
      [{ personId: A, amountCents: 10000 }],
      PEOPLE,
      [
        { personId: A, amountCents: 2000 },
        { personId: B, amountCents: 3000 },
        { personId: C, amountCents: 4000 },
      ],
    );
    expect(v.ok).toBe(false);
  });

  it('accepts a valid equal split', () => {
    const shares = calculateExpenseShares(15000, PEOPLE, 'equal');
    const v = validateExpense(15000, [{ personId: A, amountCents: 15000 }], PEOPLE, shares);
    expect(v.ok).toBe(true);
  });

  it('rejects a transfer with same sender and receiver', () => {
    expect(validateTransfer(1000, A, A).ok).toBe(false);
    expect(validateTransfer(1000, A, B).ok).toBe(true);
    expect(validateTransfer(0, A, B).ok).toBe(false);
  });
});

describe('multi-payer expenses', () => {
  it('two people chipping in different amounts, one contributing nothing', () => {
    // $50 total: Sam(c) pays $30, Armaan(a) pays $20, Rooh(b) pays nothing.
    // Split equally among all three; later balances should all settle to 0
    // once the right repayments are made.
    const amountCents = 5000;
    const expense: Transaction = {
      id: '1',
      type: 'expense',
      payments: [
        { personId: C, amountCents: 3000 },
        { personId: A, amountCents: 2000 },
      ],
      amountCents,
      description: 'Groceries',
      category: 'Food',
      date: '2024-01-01',
      participants: PEOPLE,
      splitType: 'equal',
      shares: calculateEqualShares(amountCents, PEOPLE),
      createdAt: 1,
    };
    const balances = calculateBalances(PEOPLE, [expense]);
    // Sum must always be (near) zero.
    expect(balances.a + balances.b + balances.c).toBe(0);
    // A paid 2000, consumed ~1667 → owed a bit
    expect(balances.a).toBeGreaterThan(0);
    // B paid 0, consumed ~1667 → owes
    expect(balances.b).toBeLessThan(0);
    // C paid 3000, consumed ~1667 → owed the most
    expect(balances.c).toBeGreaterThan(balances.a);

    const settlement = calculateSettlement(balances);
    const residual = { ...balances };
    for (const p of settlement) {
      residual[p.from] += p.amountCents;
      residual[p.to] -= p.amountCents;
    }
    for (const v of Object.values(residual)) expect(v).toBe(0);
  });

  it('validateExpensePayments rejects payments that do not sum to the total', () => {
    const v = validateExpensePayments(5000, [
      { personId: A, amountCents: 2000 },
      { personId: C, amountCents: 2000 },
    ]);
    expect(v.ok).toBe(false);
  });

  it('validateExpensePayments accepts payments that sum exactly', () => {
    const v = validateExpensePayments(5000, [
      { personId: A, amountCents: 2000 },
      { personId: C, amountCents: 3000 },
    ]);
    expect(v.ok).toBe(true);
  });

  it('validateExpensePayments rejects a duplicate payer', () => {
    const v = validateExpensePayments(5000, [
      { personId: A, amountCents: 2000 },
      { personId: A, amountCents: 3000 },
    ]);
    expect(v.ok).toBe(false);
  });

  it('validateExpensePayments rejects a zero or negative payment', () => {
    const v = validateExpensePayments(5000, [
      { personId: A, amountCents: 5000 },
      { personId: B, amountCents: 0 },
    ]);
    expect(v.ok).toBe(false);
  });
});

describe('perPersonStats', () => {
  it('tracks paid vs consumed per person', () => {
    const tx: Transaction[] = [
      makeEqualExpense({ id: '1', paidBy: A, amountCents: 30000, date: 'd', participants: PEOPLE }),
      makeEqualExpense({ id: '2', paidBy: B, amountCents: 6000, date: 'd', participants: [A, B] }),
    ];
    const s = perPersonStats(PEOPLE, tx);
    expect(s[A].paid).toBe(30000);
    expect(s[B].paid).toBe(6000);
    expect(s[C].paid).toBe(0);
    expect(s[A].share).toBe(10000 + 3000);
    expect(s[B].share).toBe(10000 + 3000);
    expect(s[C].share).toBe(10000);
  });
});
