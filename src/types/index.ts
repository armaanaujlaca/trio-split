export type PersonId = string;

export interface Person {
  id: PersonId;
  name: string;
}

export type SplitType = 'equal' | 'custom';

export interface ExpenseShare {
  personId: PersonId;
  /** Amount in integer cents. */
  amountCents: number;
}

export interface ExpensePayment {
  personId: PersonId;
  /** Amount in integer cents. */
  amountCents: number;
}

export interface Expense {
  id: string;
  type: 'expense';
  /** Who paid and how much each person contributed. Sum must equal amountCents. */
  payments: ExpensePayment[];
  /** Amount in integer cents. */
  amountCents: number;
  description: string;
  category: string;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  participants: PersonId[];
  splitType: SplitType;
  shares: ExpenseShare[];
  createdAt: number;
}

export interface Transfer {
  id: string;
  type: 'transfer';
  from: PersonId;
  to: PersonId;
  /** Amount in integer cents. */
  amountCents: number;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  note: string;
  createdAt: number;
}

export type Transaction = Expense | Transfer;

export interface AppState {
  people: Person[];
  transactions: Transaction[];
  categories: string[];
  settings: {
    currency: string;
    dark: boolean;
    seeded: boolean;
  };
}

export interface SettlementPayment {
  from: PersonId;
  to: PersonId;
  amountCents: number;
}
