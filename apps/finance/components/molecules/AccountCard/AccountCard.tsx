import Link from "next/link";
import { AccountBadge } from "@/components/atoms/AccountBadge/AccountBadge";
import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay/CurrencyDisplay";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { BankAccount } from "@/generated/prisma/client";
import Decimal from "decimal.js";

interface AccountCardProps {
  account: BankAccount;
  now: number;
  onClick?: () => void;
  href?: string;
}

function getHoursDiff(date: Date, now: number) {
  return Math.round((date.getTime() - now) / (100 * 60 * 60));
}

function isRecentlySync(date: Date | null, now: number) {
  if (!date) return false;
  return now - date.getTime() < 24 * 60 * 60 * 1000;
}

function SyncDot({
  lastSyncedAt,
  now,
}: {
  lastSyncedAt: Date | null;
  now: number;
}) {
  const isRecent = isRecentlySync(lastSyncedAt, now);

  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full",
        isRecent ? "bg-emerald-500" : "bg-zinc-600",
      )}
      title={isRecent ? "Synced recently" : "Manual or not synced"}
    />
  );
}

const rtf = new Intl.RelativeTimeFormat("es-CO", { numeric: "auto" });

const CARD_CLASS =
  "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/50 w-full";

export function AccountCard({ account, now, onClick, href }: AccountCardProps) {
  const isDebt =
    account.type === "CREDIT_CARD" ||
    account.type === "LOAN" ||
    account.type === "MORTGAGE";

  const hoursDiff = account.last_synced_at
    ? getHoursDiff(new Date(account.last_synced_at), now)
    : null;

  const syncLabel = account.last_synced_at
    ? `Synced ${rtf.format(hoursDiff!, "hour")}`
    : account.sync_method.replace("_", " ").toLowerCase();

  const content = (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <AccountBadge type={account.type} />
        <SyncDot lastSyncedAt={account.last_synced_at} now={now} />
      </div>

      {/* Account identity */}
      <div>
        <p className="text-sm font-semibold text-foreground">
          {account.institution}
        </p>
        <p className="text-xs text-muted-foreground">{account.name}</p>
      </div>

      {/* Balance */}
      <div>
        <CurrencyDisplay
          centavos={account.balance_centavos}
          currency={account.currency}
          colorCode={isDebt}
          className="text-base font-bold"
        />
        {account.is_uvr_mortgage && account.uvr_balance && (
          <p className="text-xs text-violet-400 mt-0.5">
            {money.formatUVR(new Decimal(account.uvr_balance.toString()))}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2">
        {account.is_afc && (
          <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
            AFC
          </span>
        )}
        <span className="text-[11px] text-muted-foreground">{syncLabel}</span>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={CARD_CLASS}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={CARD_CLASS}>
      {content}
    </button>
  );
}
