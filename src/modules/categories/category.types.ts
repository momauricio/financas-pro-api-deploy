export type CategoryDto = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  active: boolean;
};

export type PaginatedCategories = {
  items: CategoryDto[];
  page: number;
  pageSize: number;
  total: number;
};
