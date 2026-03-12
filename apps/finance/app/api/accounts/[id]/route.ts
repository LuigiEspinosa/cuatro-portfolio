import { type NextRequest } from "next/server";
import { requireAuth, jsonResponse } from "@/lib/api-auth";
import { deleteAccount, findAccount, updateAccount } from "@/lib/db/accounts";
import { listTransactions } from "@/lib/db/transactions";
import { UpdateAccountSchema } from "@/lib/validators/accounts";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { user } = await requireAuth(request);
    const { id } = await params;
    const account = await findAccount(id, user.id);
    const transactions = await listTransactions(id, { limit: 20 });
    return jsonResponse({ account, transactions });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof Error && err.message === "NOT_FOUND")
      return jsonResponse({ error: "Not found" }, { status: 404 });
    throw err;
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { user } = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: parsed.error.issues[0]?.message ?? "Invalid Input" },
        { status: 400 },
      );
    }
    const account = await updateAccount(id, user.id, parsed.data);
    return jsonResponse({ account });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof Error && err.message === "NOT_FOUND")
      return jsonResponse({ error: "Not found" }, { status: 404 });
    throw err;
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { user } = await requireAuth(request);
    const { id } = await params;
    await deleteAccount(id, user.id);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof Error && err.message === "NOT_FOUND")
      return jsonResponse({ error: "Not found" }, { status: 404 });
    throw err;
  }
}
