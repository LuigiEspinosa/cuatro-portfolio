import { db } from "@/lib/db";
import type { Transaction } from "@/generated/prisma/client";
import type { CreateTransactionInput } from "../validators/transactions";

export async function listTransactions(
  accountId: string,
  opts: { limit?: number; cursor?: string } = {},
): Promise<Transaction[]> {
  const limit = opts.limit ?? 50;
  return db.transaction.findMany({
    where: {
      account_id: accountId,
      // Cursor is the ISO date of the oldest transacted_at from the previous page
      ...(opts.cursor ? { transacted_at: { lt: new Date(opts.cursor) } } : {}),
    },
    orderBy: { transacted_at: "desc" },
    take: limit,
  });
}

export async function createTransaction(
  accountId: string,
  data: CreateTransactionInput,
): Promise<Transaction> {
  return db.transaction.create({
    data: {
      account_id: accountId,
      amount_centavos: data.amount_centavos,
      currency: data.currency,
      description: data.description,
      type: data.type,
      transacted_at: data.transacted_at,
      notes: data.notes,
      // No external_id for manual enries
      // No category_id
    },
  });
}
