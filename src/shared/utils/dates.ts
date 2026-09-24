export function toDateId(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toMonthId(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseDateId(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

export function prevMonthId(monthId: string): string {
  const [year, month] = monthId.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return toMonthId(date);
}

export function shiftMonthId(monthId: string, delta: number): string {
  const [year, month] = monthId.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return toMonthId(date);
}

export function addMonthsToDateId(dateStr: string, months: number): string {
  const date = parseDateId(dateStr);
  date.setMonth(date.getMonth() + months);
  return toDateId(date);
}

export function calculateInvoiceMonthId(
  purchaseDateStr: string,
  closingDay?: number | null,
): string {
  if (closingDay == null) {
    return purchaseDateStr.substring(0, 7);
  }
  const date = parseDateId(purchaseDateStr);
  if (date.getDate() > closingDay) {
    date.setMonth(date.getMonth() + 1);
  }
  return toMonthId(date);
}

export function dateIdInMonth(monthId: string, dayOfMonth: number): string {
  const [year, month] = monthId.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(dayOfMonth, 1), lastDay);
  return `${monthId}-${String(day).padStart(2, '0')}`;
}

export function daysBetween(dateIdA: string, dateIdB: string): number {
  const a = new Date(`${dateIdA}T12:00:00`);
  const b = new Date(`${dateIdB}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function daysInMonth(monthId: string): number {
  const [year, month] = monthId.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}
