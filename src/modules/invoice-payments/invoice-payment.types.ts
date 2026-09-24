export type InvoicePaymentDto = {
  id: string;
  monthId: string;
  cardId: string;
  isPaid: boolean;
};

export type PaginatedInvoicePayments = {
  items: InvoicePaymentDto[];
  page: number;
  pageSize: number;
  total: number;
};
