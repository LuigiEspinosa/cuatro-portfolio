import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { findAccount } from "@/lib/db/accounts";
import { listTransactions } from "@/lib/db/transactions";
import { groupByDate } from "@/lib/utils/group-by-date";
import { AccountBadge } from "@/components/atoms/AccountBadge/AccountBadge";
import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay/CurrencyDisplay";
import { AccountDetailClient } from "./AccountDetailClient";
import { money } from "@/lib/money";
import Decimal from "decimal.js";

type Params = { params: Promise<{ id: string }> };

export default async function AccountDetailPage({ params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;

  let account;
  try {
    account = await findAccount(id, session.user.id);
  } catch {
    notFound();
  }

  const transactions = await listTransactions(id, { limit: 50 });
  const groups = groupByDate(transactions);

  return (
    <div className="space-y-6">
      <Link
        href="/accounts"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Cuentas
      </Link>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AccountBadge type={account.type} />
              {account.is_afc && (
                <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                  AFC
                </span>
              )}
            </div>
            <h1 className="text-lg font-semibold">{account.institution}</h1>
            <p className="text-sm text-muted-foreground">{account.name}</p>
          </div>
          <div className="text-right">
            <CurrencyDisplay
              centavos={account.balance_centavos}
              currency={account.currency}
              colorCode={
                account.type === "CREDIT_CARD" ||
                account.type === "LOAN" ||
                account.type === "MORTGAGE"
              }
              className="text-xl font-bold"
            />
            {account.is_uvr_mortgage && account.uvr_balance && (
              <p className="text-sm text-violet-400 mt-1">
                {money.formatUVR(new Decimal(account.uvr_balance.toString()))}
              </p>
            )}
          </div>
        </div>
      </div>

      <AccountDetailClient account={account} groups={groups} />
    </div>
  );
}
