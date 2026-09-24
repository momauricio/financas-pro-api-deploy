export type CreditCardDto = {
  id: string;
  name: string;
  brand: string | null;
  limit: number;
  closingDay: number;
  dueDay: number;
  active: boolean;
};

export type PaginatedCreditCards = {
  items: CreditCardDto[];
  page: number;
  pageSize: number;
  total: number;
};
