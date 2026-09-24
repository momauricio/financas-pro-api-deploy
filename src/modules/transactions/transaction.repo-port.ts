export type TransactionRecord = {
  id: string;
  userId: string | null;
  description: string;
  amount: { toString(): string } | string | number;
  category: string;
  date: Date | string;
  isPaid: boolean | null;
  type: string;
  isFixed: boolean | null;
  installments: unknown;
  paymentMethod: string | null;
  cardId: string | null;
  invoiceMonthId: string | null;
  recurringGroupId: string | null;
  refundOfTransactionId: string | null;
  investmentAssetId: string | null;
  purchaseUsdRate: { toString(): string } | string | number | null;
  sharesBought: { toString(): string } | string | number | null;
  createdAt?: Date | null;
};

export type TransactionCreateInput = {
  userId: string;
  description: string;
  amount: string;
  category: string;
  date: Date;
  isPaid: boolean;
  type: string;
  isFixed: boolean;
  installments?: { current: number; total: number } | null;
  paymentMethod?: string | null;
  cardId?: string | null;
  invoiceMonthId?: string | null;
  recurringGroupId?: string | null;
  refundOfTransactionId?: string | null;
  investmentAssetId?: string | null;
  purchaseUsdRate?: string | null;
  sharesBought?: string | null;
};

export type TransactionUpdateData = Record<string, unknown>;

export interface TransactionRepositoryPort {
  listByUser(
    userId: string,
    opts: {
      skip: number;
      take: number;
      monthId?: string;
      invoiceMonthId?: string;
    },
  ): Promise<{ rows: TransactionRecord[]; total: number }>;

  findByIdForUser(id: string, userId: string): Promise<TransactionRecord | null>;

  findCardClosingDay(cardId: string, userId: string): Promise<number | null>;

  createMany(rows: TransactionCreateInput[]): Promise<TransactionRecord[]>;

  update(
    id: string,
    userId: string,
    data: TransactionUpdateData,
  ): Promise<TransactionRecord | null>;

  updateByGroup(
    userId: string,
    recurringGroupId: string,
    data: TransactionUpdateData,
    dateFilter?: { gte?: Date; lte?: Date },
  ): Promise<number>;

  delete(id: string, userId: string): Promise<boolean>;

  listByGroup(
    userId: string,
    recurringGroupId: string,
    dateFilter?: { gte?: Date; lte?: Date },
  ): Promise<TransactionRecord[]>;

  deleteByGroup(
    userId: string,
    recurringGroupId: string,
    dateFilter?: { gte?: Date; lte?: Date },
  ): Promise<number>;

  findByRecurringGroup(
    userId: string,
    recurringGroupId: string,
  ): Promise<TransactionRecord[]>;
}
