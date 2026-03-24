import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AccountCard } from "./AccountCard";
import type { BankAccount } from "@/generated/prisma/client";
import Decimal from "decimal.js";

const meta: Meta<typeof AccountCard> = {
  title: "Molecules/AccountCard",
  component: AccountCard,
};
export default meta;
type Story = StoryObj<typeof AccountCard>;

const base: BankAccount = {
  id: "1",
  userId: "u1",
  name: "Ahorros",
  institution: "Bancolombia",
  type: "SAVINGS",
  currency: "COP",
  balance_centavos: 425000000n,
  belvo_account_id: null,
  belvo_link_token: null,
  sync_method: "MANUAL",
  last_synced_at: null,
  is_afc: false,
  is_uvr_mortgage: false,
  uvr_balance: null,
  created_at: new Date(),
  updated_at: new Date(),
};

export const Savings: Story = { args: { account: base } };

export const CreditCard: Story = {
  args: {
    account: {
      ...base,
      name: "Tarjeta MasterCard",
      institution: "Bancolombia",
      type: "CREDIT_CARD",
      balance_centavos: -85000000n,
      sync_method: "CSV_IMPORT",
    },
    now: Date.now(),
  },
};

export const UVRMortgage: Story = {
  args: {
    account: {
      ...base,
      name: "Hipoteca",
      institution: "BBVA",
      type: "MORTGAGE",
      balance_centavos: -218450000000n,
      is_uvr_mortgage: true,
      uvr_balance: new Decimal("1284.30"),
      sync_method: "BELVO",
      last_synced_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    now: Date.now(),
  },
};

export const AFC: Story = {
  args: {
    account: {
      ...base,
      name: "AFC",
      institution: "BBVA",
      type: "AFC",
      balance_centavos: 12000000n,
      is_afc: true,
    },
    now: Date.now(),
  },
};
