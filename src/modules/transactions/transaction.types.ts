export type TransactionType = 'income' | 'expense';
export type PaymentMethod = 'Crédito' | 'Débito' | 'Pix' | 'Dinheiro';
export type InstallmentActionScope = 'current' | 'future' | 'past' | 'all';

export type InstallmentsDto = {
  current: number;
  total: number;
};

export type TransactionDto = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  isPaid: boolean;
  type: TransactionType;
  isFixed: boolean;
  installments?: InstallmentsDto;
  paymentMethod?: PaymentMethod | null;
  cardId?: string | null;
  invoiceMonthId?: string | null;
  recurringGroupId?: string | null;
  refundOfTransactionId?: string | null;
  investmentAssetId?: string | null;
  purchaseUsdRate?: number | null;
  sharesBought?: number | null;
};

export type PaginatedTransactions = {
  items: TransactionDto[];
  page: number;
  pageSize: number;
  total: number;
};
