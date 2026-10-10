import type {
  Expense,
  ExpensePayment,
  ExpenseShare,
  PersonId,
  SplitType,
  Transaction,
} from '../types';

/**
 * Split an amount in integer cents equally across N participants.
 * Distributes any leftover cents one-by-one starting from the first participant,
 * so the sum of shares always equals the exact total.
 */
export function calculateEqualShares(
  amountCents: number,
  participantIds: PersonId[],
): ExpenseShare[] {
  if (participantIds.length === 0) return [];
  const base = Math.floor(amountCents / participantIds.length);
  const remainder = amountCents - base * participantIds.length;
  return participantIds.map((personId, i) => ({
    personId,
    amountCents: base + (i < remainder ? 1 : 0),
  }));
}

/**
 * Compute shares for an expense given the split type.
 * For 'custom', shares are returned as-is (caller validates sum == total).
 */
export function calculateExpenseShares(
  amountCents: number,
  participantIds: PersonId[],
  splitType: SplitType,
  customShares?: ExpenseShare[],
): ExpenseShare[] {
  if (splitType === 'equal') {
    return calculateEqualShares(amountCents, participantIds);
  }
  if (splitType === 'custom' && customShares) {
    return customShares.map((s) => ({ ...s }));
  }
  return [];
}

export function sumShares(shares: ExpenseShare[]): number {
  return shares.reduce((total, s) => total + s.amountCents, 0);
}

export function sumPayments(payments: ExpensePayment[]): number {
  return payments.reduce((total, p) => total + p.amountCents, 0);
}

export interface ExpenseValidation {
  ok: boolean;
  errors: string[];
}

/**
 * Validate that a set of payments (one or more people each paying a portion)
 * is internally consistent:
 *  - at least one payer
 *  - no duplicate payers
 *  - each payment amount > 0
 *  - sum of payments equals the expense total
 */
export function validateExpensePayments(
  amountCents: number,
  payments: ExpensePayment[],
): ExpenseValidation {
  const errors: string[] = [];
  if (payments.length === 0) {
    errors.push('Select at least one person who paid.');
  }
  if (payments.some((p) => p.amountCents <= 0)) {
    errors.push('Each payer amount must be greater than $0.');
  }
  const ids = payments.map((p) => p.personId);
  if (new Set(ids).size !== ids.length) {
    errors.push('Each person can only appear once as a payer.');
  }
  const total = sumPayments(payments);
  if (total !== amountCents) {
    errors.push(
      `Payments (${(total / 100).toFixed(2)}) must sum to the total (${(
        amountCents / 100
      ).toFixed(2)}).`,
    );
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Validate an expense is internally consistent:
 *  - amount > 0
 *  - payments sum to the total (see validateExpensePayments)
 *  - at least one participant
 *  - shares cover exactly the participants (same set)
 *  - sum of shares equals amount
 */
export function validateExpense(
  amountCents: number,
  payments: ExpensePayment[],
  participants: PersonId[],
  shares: ExpenseShare[],
): ExpenseValidation {
  const errors: string[] = [];
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    errors.push('Amount must be greater than $0.');
  }
  errors.push(...validateExpensePayments(amountCents, payments).errors);
  if (participants.length === 0) errors.push('Select at least one participant.');
  const shareSet = new Set(shares.map((s) => s.personId));
  const partSet = new Set(participants);
  if (shareSet.size !== partSet.size || [...shareSet].some((id) => !partSet.has(id))) {
    errors.push('Shares must match participants exactly.');
  }
  if (shares.some((s) => s.amountCents < 0)) {
    errors.push('Shares cannot be negative.');
  }
  const total = sumShares(shares);
  if (total !== amountCents) {
    errors.push(
      `Shares (${(total / 100).toFixed(2)}) must sum to the total (${(
        amountCents / 100
      ).toFixed(2)}).`,
    );
  }
  return { ok: errors.length === 0, errors };
}

export interface TransferValidation {
  ok: boolean;
  errors: string[];
}

export function validateTransfer(
  amountCents: number,
  from: PersonId | '',
  to: PersonId | '',
): TransferValidation {
  const errors: string[] = [];
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    errors.push('Amount must be greater than $0.');
  }
  if (!from) errors.push('Select the sender.');
  if (!to) errors.push('Select the receiver.');
  if (from && to && from === to) {
    errors.push('Sender and receiver must be different.');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Calculate every person's net balance in cents from a list of transactions.
 *
 *   Expense: each payer gets +their payment, each participant gets -their share.
 *            (One expense can have several payers who covered different portions.)
 *   Transfer: 'from' gets +amount, 'to' gets -amount
 *             (i.e. 'from' pays down their debt, 'to' had been owed less).
 *
 * Positive = owed money, Negative = owes money.
 * The sum across all people should always be 0.
 */
export function calculateBalances(
  peopleIds: PersonId[],
  transactions: Transaction[],
): Record<PersonId, number> {
  const balances: Record<PersonId, number> = {};
  for (const id of peopleIds) balances[id] = 0;

  for (const tx of transactions) {
    if (tx.type === 'expense') {
      for (const payment of tx.payments) {
        balances[payment.personId] = (balances[payment.personId] ?? 0) + payment.amountCents;
      }
      for (const share of tx.shares) {
        balances[share.personId] = (balances[share.personId] ?? 0) - share.amountCents;
      }
    } else {
      balances[tx.from] = (balances[tx.from] ?? 0) + tx.amountCents;
      balances[tx.to] = (balances[tx.to] ?? 0) - tx.amountCents;
    }
  }
  return balances;
}

/**
 * Returns per-person "paid" (total cash out from expenses they covered)
 * and "share" (total they personally consumed).
 */
export function perPersonStats(
  peopleIds: PersonId[],
  transactions: Transaction[],
): Record<PersonId, { paid: number; share: number }> {
  const stats: Record<PersonId, { paid: number; share: number }> = {};
  for (const id of peopleIds) stats[id] = { paid: 0, share: 0 };
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    for (const payment of tx.payments) {
      const cur = stats[payment.personId] ?? { paid: 0, share: 0 };
      stats[payment.personId] = { paid: cur.paid + payment.amountCents, share: cur.share };
    }
    for (const s of tx.shares) {
      const cur = stats[s.personId] ?? { paid: 0, share: 0 };
      stats[s.personId] = { paid: cur.paid, share: cur.share + s.amountCents };
    }
  }
  return stats;
}

/** Helper used by tests and the UI quick-add flow for the common single-payer case. */
export function makeEqualExpense(args: {
  id: string;
  paidBy: PersonId;
  amountCents: number;
  description?: string;
  category?: string;
  date: string;
  participants: PersonId[];
  createdAt?: number;
}): Expense {
  return {
    id: args.id,
    type: 'expense',
    payments: [{ personId: args.paidBy, amountCents: args.amountCents }],
    amountCents: args.amountCents,
    description: args.description ?? '',
    category: args.category ?? 'Other',
    date: args.date,
    participants: args.participants,
    splitType: 'equal',
    shares: calculateEqualShares(args.amountCents, args.participants),
    createdAt: args.createdAt ?? Date.now(),
  };
}
