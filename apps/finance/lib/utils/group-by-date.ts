import type { Transaction } from "@/generated/prisma/client";

export interface TransactionGroup {
  label: string;
  items: Transaction[];
}

function dateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Hoy";
  if (sameDay(date, yesterday)) return "Ayer";

  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function groupByDate(transactions: Transaction[]): TransactionGroup[] {
  const map = new Map<string, Transaction[]>();

  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(b.transacted_at).getTime() - new Date(a.transacted_at).getTime(),
  );

  for (const tx of sorted) {
    const date = new Date(tx.transacted_at);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }

  return Array.from(map.entries()).map(([, items]) => ({
    label: dateLabel(new Date(items[0]!.transacted_at)),
    items,
  }));
}
