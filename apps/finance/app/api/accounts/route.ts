import { type NextRequest } from "next/server";
import { requireAuth, jsonResponse } from "@/lib/api-auth";
import { listAccounts, createAccount } from "@/lib/db/accounts";
import { CreateAccountSchema } from "@/lib/validators/accounts";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const accounts = await listAccounts(user.id);
    return jsonResponse({ accounts });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const body = await request.json();
    const parsed = CreateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: parsed.error.issues[0]?.message ?? "Invalid Input" },
        { status: 400 },
      );
    }
    const account = await createAccount(user.id, parsed.data);
    return jsonResponse({ account }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}
