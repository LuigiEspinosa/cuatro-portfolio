import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay/CurrencyDisplay";
import type { Transaction } from "@/generated/prisma/client";

interface TransactionRowProps {
  transaction: Transaction;
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* TODO: Icon Placeholder - Replace with Component */}
      <div className="h-8 w-8 shrink-0 rounded-lg bg-zinc-800" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {transaction.description}
        </p>
        <p className="text-sx text-muted-foregrond">
          {/* TODO: category_id is null for now */}
          Sin categoria
        </p>
      </div>

      <CurrencyDisplay
        centavos={transaction.amount_centavos}
        currency={transaction.currency}
        colorCode
        showSign
        className="shrink-0 text-sm font-semibold"
      />
    </div>
  );
}
