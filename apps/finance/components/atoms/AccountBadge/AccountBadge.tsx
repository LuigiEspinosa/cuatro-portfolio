import { cn } from "@/lib/utils";
import type { AccountType } from "@/generated/prisma/enums";

const LABEL: Record<AccountType, string> = {
  SAVINGS: "Ahorros",
  CHECKING: "Corriente",
  CREDIT_CARD: "Tarjeta",
  LOAN: "Crédito",
  MORTGAGE: "Hipoteca",
  AFC: "AFC",
  INVESTMENT: "Inversión",
  CRYPTO: "Crypto",
};

const COLOR: Record<AccountType, string> = {
  SAVINGS: "bg-zinc-800 text-zinc-300",
  CHECKING: "bg-zinc-800 text-zinc-300",
  CREDIT_CARD: "bg-red-950 text-red-400",
  LOAN: "bg-purple-950 text-purple-400",
  MORTGAGE: "bg-purple-950 text-purple-400",
  AFC: "bg-emerald-950 text-emerald-400",
  INVESTMENT: "bg-blue-950 text-blue-400",
  CRYPTO: "bg-blue-950 text-blue-400",
};

interface AccountBadgeProps {
  type: AccountType;
  className?: string;
}

export function AccountBadge({ type, className }: AccountBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        COLOR[type],
        className,
      )}
    >
      {LABEL[type]}
    </span>
  );
}
