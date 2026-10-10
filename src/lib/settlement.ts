import type { PersonId, SettlementPayment } from '../types';

/**
 * Greedy debt-settlement algorithm.
 *
 * Takes a map of personId -> net balance in integer cents and returns the
 * minimum practical set of payments that zeroes everyone out.
 *
 *  1. Separate people into creditors (balance > 0) and debtors (balance < 0).
 *  2. Repeatedly pair the largest creditor with the largest debtor, create a
 *     payment of min(creditor, |debtor|), and reduce both.
 *  3. Stop when all are within ±1 cent of zero.
 *
 * This produces an optimal number of transactions for the common case where
 * one creditor can absorb a debtor exactly (and is near-optimal otherwise;
 * true min-transaction debt simplification is NP-hard but this greedy approach
 * is standard for Splitwise-style apps).
 */
export function calculateSettlement(
  balances: Record<PersonId, number>,
): SettlementPayment[] {
  const creditors: { id: PersonId; amount: number }[] = [];
  const debtors: { id: PersonId; amount: number }[] = [];

  for (const [id, balance] of Object.entries(balances)) {
    if (balance > 0) creditors.push({ id, amount: balance });
    else if (balance < 0) debtors.push({ id, amount: -balance });
  }

  // Sort by magnitude descending so we settle the biggest numbers first.
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const payments: SettlementPayment[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const cred = creditors[ci];
    const deb = debtors[di];
    const pay = Math.min(cred.amount, deb.amount);

    if (pay > 0) {
      payments.push({ from: deb.id, to: cred.id, amountCents: pay });
    }

    cred.amount -= pay;
    deb.amount -= pay;

    if (cred.amount === 0) ci++;
    if (deb.amount === 0) di++;
  }

  return payments;
}

export function isAllSettled(balances: Record<PersonId, number>): boolean {
  // Allow a tiny tolerance even though we work in integer cents.
  return Object.values(balances).every((b) => Math.abs(b) <= 0);
}
