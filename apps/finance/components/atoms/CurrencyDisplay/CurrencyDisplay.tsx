import { money } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Currency } from "@/generated/prisma/enums";

interface CurrencyDisplayProps {
  centavos: bigint;
  currency?: Currency;
  showSign?: boolean;
  colorCode?: boolean;
  className?: string;
}

export function CurrencyDisplay({
  centavos,
  currency = "COP",
  showSign = false,
  colorCode = false,
  className,
}: CurrencyDisplayProps) {
  const isNegative = centavos < 0n;
  const isPositive = centavos > 0n;

  let formatted: string;
  switch (currency) {
    case "USD":
      formatted = money.formatUSD(centavos < 0n ? -centavos : centavos);
      break;
    default:
      formatted = money.formatCOP(centavos < 0n ? -centavos : centavos);
  }

  const sign = isNegative ? "- " : showSign && isPositive ? "+ " : "";

  return (
    <span
      className={cn(
        colorCode && isNegative && "text-red-500",
        colorCode && isPositive && "text-emerald-500",
        colorCode && !isNegative && !isPositive && "text-muted-foreground",
        className,
      )}
    >
      {sign}
      {formatted}
    </span>
  );
}
