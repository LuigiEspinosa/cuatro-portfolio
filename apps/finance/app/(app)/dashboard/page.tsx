import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { listAccounts } from "@/lib/db/accounts";
import { money } from "@/lib/money";
import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay/CurrencyDisplay";
import { AccountCard } from "@/components/molecules/AccountCard/AccountCard";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const accounts = await listAccounts(session.user.id);
  const netWorth = money.sum(accounts.map((a) => a.balance_centavos));
  const preview = accounts.slice(0, 4);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Patrimonio neto</p>
        <CurrencyDisplay
          centavos={netWorth}
          colorCode
          showSign={false}
          className="text-3xl font-bold"
        />
        <p className="text-xs text-muted-foreground mt-1">
          en {accounts.length} cuenta{accounts.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Cuentas</h2>
          <Link
            href="/accounts"
            className="text-xs text-violet-400 hover:text-violet-300"
          >
            Ver todas →
          </Link>
        </div>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tienes cuentas.{" "}
            <Link href="/accounts" className="text-violet-400 hover:underline">
              Agrega la primera
            </Link>
            .
          </p>
        ) : (
          <div className="grid- grid-cols-2 gap-4">
            {preview.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                href={`/accounts/${account.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
