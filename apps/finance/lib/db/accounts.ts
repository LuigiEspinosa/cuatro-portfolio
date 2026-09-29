import { db } from "@/lib/db";
import type { BankAccount } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import type {
  CreateAccountInput,
  UpdateAccountInput,
} from "@/lib/validators/accounts";

export async function listAccounts(userId: string): Promise<BankAccount[]> {
  return db.bankAccount.findMany({
    where: { userId },
    orderBy: [{ institution: "asc" }, { name: "asc" }],
  });
}

// Route handlers must call this before any transaction repository function
export async function findAccount(
  id: string,
  userId: string,
): Promise<BankAccount> {
  const account = await db.bankAccount.findFirst({
    where: { id, userId },
  });
  if (!account) throw new Error("NOT_FOUND");
  return account;
}

export async function createAccount(
  userId: string,
  data: CreateAccountInput,
): Promise<BankAccount> {
  return db.bankAccount.create({
    data: {
      userId,
      name: data.name,
      institution: data.institution,
      type: data.type,
      currency: data.currency,
      balance_centavos: data.balance_centavos,
      is_afc: data.is_afc ?? false,
      is_uvr_mortgage: data.is_uvr_mortgage ?? false,
      uvr_balance: data.uvr_balance
        ? new Prisma.Decimal(data.uvr_balance)
        : null,
    },
  });
}

export async function updateAccount(
  id: string,
  userId: string,
  data: UpdateAccountInput,
): Promise<BankAccount> {
  await findAccount(id, userId);
  return db.bankAccount.update({
    where: { id },
    data: {
      ...data,
      uvr_balance:
        data.uvr_balance !== undefined
          ? new Prisma.Decimal(data.uvr_balance)
          : undefined,
    },
  });
}

export async function deleteAccount(id: string, userId: string): Promise<void> {
  await findAccount(id, userId);
  await db.bankAccount.delete({ where: { id } });
}
