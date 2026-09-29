import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listAccounts } from "@/lib/db/accounts";
import { AccountsClient } from "./AccountsClient";

export default async function AccountsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const accounts = await listAccounts(session.user.id);

  return (
    <div className="space-y-6">
      <AccountsClient accounts={accounts} />
    </div>
  );
}
