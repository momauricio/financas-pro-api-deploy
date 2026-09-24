export type GoalDto = {
  id: string;
  monthId: string;
  category: string;
  amount: number;
};

export type PaginatedGoals = {
  items: GoalDto[];
  page: number;
  pageSize: number;
  total: number;
};
