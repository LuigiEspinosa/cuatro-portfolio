"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BankAccount } from "@/generated/prisma/client";
import { AccountCard } from "@/components/molecules/AccountCard/AccountCard";
import { AddAccountModal } from "./AddAccountModal";
import { Button } from "@/components/ui/button";

interface AccountsClientProps {
  accounts: BankAccount[];
}

export function AccountsClient({ accounts }: AccountsClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cuentas</h1>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          + Agregar Cuenta
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onClick={() => router.push(`/accounts/${account.id}`)}
          />
        ))}

        <button
          onClick={() => setModalOpen(true)}
          className="flex min-h-32 items-center justiy-center rounded-xl border border-dashed border-border text-muted-foreground hover:bg-accent/30 transition-colors"
        >
          <span className="text-sm">+ Agregar cuenta</span>
        </button>
      </div>

      <AddAccountModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
