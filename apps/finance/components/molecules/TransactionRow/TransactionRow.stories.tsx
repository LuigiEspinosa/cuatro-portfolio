import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TransactionRow } from "./TransactionRow";
import type { Transaction } from "@/generated/prisma/client";

const meta: Meta<typeof TransactionRow> = {
  title: "Molecules/TransactionRow",
  component: TransactionRow,
};
export default meta;
type Story = StoryObj<typeof TransactionRow>;

const base: Transaction = {
  id: "1",
  account_id: "a1",
  amount_centavos: -4500000n,
  currency: "COP",
  cop_rate: null,
  cop_amount_centavos: null,
  description: "HBO",
  merchant_name: null,
  category_id: null,
  type: "DEBIT",
  transacted_at: new Date(),
  imported_at: new Date(),
  external_id: null,
  is_duplicate: false,
  is_subscription: false,
  subscription_id: null,
  notes: null,
};

export const Debit: Story = { args: { transaction: base } };

export const Credit: Story = {
  args: {
    transaction: {
      ...base,
      id: "1",
      amount_centavos: 420000000n,
      description: "Salario",
      type: "CREDIT",
    },
  },
};

export const LongDescription: Story = {
  args: {
    transaction: {
      ...base,
      id: "3",
      description:
        "TRANSFERENCIA BANCOLOMBIA A CUENTA DE AHORROS 123456789 REF 987654",
    },
  },
};
