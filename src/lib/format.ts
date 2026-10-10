import type { ExpensePayment } from '../types';

export function formatCurrency(cents: number, currency = 'CAD'): string {
  const value = cents / 100;
  try {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    const sign = value < 0 ? '-' : '';
    return `${sign}$${Math.abs(value).toFixed(2)}`;
  }
}

export function formatSignedCurrency(cents: number, currency = 'CAD'): string {
  if (cents === 0) return formatCurrency(0, currency);
  const sign = cents > 0 ? '+' : '-';
  return sign + formatCurrency(Math.abs(cents), currency);
}

/**
 * Parse user-entered dollar amount into integer cents.
 * Accepts "12", "12.5", "12.50", "$12.50", " 12,50 " (comma as decimal).
 * Returns null for invalid input (NaN, negative, > 10 trillion).
 */
export function parseAmountToCents(input: string): number | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().replace(/[$\s]/g, '').replace(',', '.');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  // Round to avoid 0.1+0.2 nonsense
  return Math.round(value * 100);
}

export function centsToDollarString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * "Sam paid" for a single payer, or "Sam ($30.00) + Armaan ($20.00) paid"
 * when an expense was covered by multiple people.
 */
export function formatPayerSummary(
  payments: ExpensePayment[],
  nameOf: (id: string) => string,
  currency = 'CAD',
): string {
  if (payments.length <= 1) {
    return `${nameOf(payments[0]?.personId ?? '')} paid`;
  }
  return (
    payments
      .map((p) => `${nameOf(p.personId)} (${formatCurrency(p.amountCents, currency)})`)
      .join(' + ') + ' paid'
  );
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
