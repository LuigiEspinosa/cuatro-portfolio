import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { findAccount, updateAccount } from "@/lib/db/accounts";
import { listTransactions, createTransaction } from "@/lib/db/transactions";
import { CreateTransactionSchema } from "@/lib/validators/transactions";
import { money } from "@/lib/money";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { user } = await requireAuth(request);
    const { id } = await params;
    await findAccount(id, user.id);
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "50");
    const cursor = searchParams.get("cursor") ?? undefined;
    const transactions = await listTransactions(id, { limit, cursor });
    const nextCursor =
      transactions.length === limit
        ? transactions[transactions.length - 1]?.transacted_at.toISOString()
        : null;
    return NextResponse.json({ transactions, nextCursor });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof Error && err.message === "NOT_FOUND")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { user } = await requireAuth(request);
    const { id } = await params;
    const account = await findAccount(id, user.id);

    const body = await request.json();
    const parsed = CreateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid Input" },
        { status: 400 },
      );
    }

    const transaction = await createTransaction(id, parsed.data);

    const newBalance =
      parsed.data.type === "CREDIT"
        ? money.add(account.balance_centavos, parsed.data.amount_centavos)
        : money.subtract(account.balance_centavos, parsed.data.amount_centavos);
    await updateAccount(id, user.id, { balance_centavos: newBalance });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof Error && err.message === "NOT_FOUND")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
