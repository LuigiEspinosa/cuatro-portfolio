"use client";

import { useState } from "react";
import type { BankAccount } from "@/generated/prisma/client";
import type { TransactionGroup } from "@/lib/utils/group-by-date";
import { TransactionRow } from "@/components/molecules/TransactionRow/TransactionRow";
import { AddTransactionModal } from "./AddTransactionModal";
import { EditAccountModal } from "./EditAccountModal";
import { Button } from "@/components/ui/button";

interface AccountDetailClientProps {
  account: BankAccount;
  groups: TransactionGroup[];
}

export function AccountDetailClient({
  account,
  groups,
}: AccountDetailClientProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          Editar
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Transacciones</h2>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          + Agregar
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted foreground">
          Sin transacciones. Agrega la primera.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="overflow-hidden rounded-xl border border-boder bg-card divide-y divide-border">
                {group.items.map((tx) => (
                  <TransactionRow key={tx.id} transaction={tx} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddTransactionModal
        accountId={account.id}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
      <EditAccountModal
        account={account}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  );
}
