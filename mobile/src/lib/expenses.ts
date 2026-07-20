import { api } from './api';

export type ExpenseSplitType = 'EQUAL' | 'PERCENTAGE' | 'CUSTOM';
export type SettlementStatus = 'UNPAID' | 'PENDING' | 'SETTLED';

export type ExpenseMember = {
  id: string;
  fullName: string;
  role: string;
  email: string;
};

export type ExpenseParticipant = {
  userId: string;
  amount?: number;
};

export type ExpenseSplit = {
  id: string;
  userId: string;
  amount: number;
  status: SettlementStatus;
  settledAt: string | null;
  user?: ExpenseMember;
};

export type ExpenseRecord = {
  id: string;
  title: string;
  amount: number;
  splitType: ExpenseSplitType;
  receiptUrl: string | null;
  createdAt: string;
  payer: ExpenseMember;
  splits: ExpenseSplit[];
};

export type BalanceRow = {
  user: ExpenseMember;
  netAmount: number;
  pendingApprovals: Array<{
    splitId: string;
    title: string;
    amount: number;
    date: string;
  }>;
};

export type BudgetStatus = {
  monthlyLimit: number;
  totalSpent: number;
  percentSpent: number;
  breakdown: {
    paidExpenses: number;
    othersOwedToYou: number;
    settledSplitsYouPaid: number;
  };
};

export async function fetchExpenseMembers() {
  return (await api.get<ExpenseMember[]>('/expenses/members')).data;
}

export async function fetchExpenseBalances() {
  return (await api.get<BalanceRow[]>('/expenses/balances')).data;
}

export async function fetchExpenses() {
  return (await api.get<ExpenseRecord[]>('/expenses')).data;
}

export async function fetchBudgetStatus() {
  return (await api.get<BudgetStatus>('/expenses/budget')).data;
}

export async function createExpense(payload: {
  title: string;
  amount: number;
  splitType: ExpenseSplitType;
  receiptUrl?: string | null;
  participants: ExpenseParticipant[];
}) {
  return (await api.post('/expenses', payload)).data;
}

export async function requestSettle(splitId: string) {
  return (await api.post(`/expenses/splits/${splitId}/request-settle`)).data;
}

export async function verifySettle(splitId: string, action: 'approve' | 'decline') {
  return (await api.post(`/expenses/splits/${splitId}/verify-settle`, { action })).data;
}

export async function updateBudget(monthlyLimit: number) {
  return (await api.post('/expenses/budget', { monthlyLimit })).data;
}