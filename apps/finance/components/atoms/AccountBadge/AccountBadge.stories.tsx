import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AccountBadge } from "./AccountBadge";

const meta: Meta<typeof AccountBadge> = {
  title: "Atoms/AccountBadge",
  component: AccountBadge,
};
export default meta;
type Story = StoryObj<typeof AccountBadge>;

export const Savings: Story = { args: { type: "SAVINGS" } };
export const Checking: Story = { args: { type: "CHECKING" } };
export const CreditCard: Story = { args: { type: "CREDIT_CARD" } };
export const Loan: Story = { args: { type: "LOAN" } };
export const Mortgage: Story = { args: { type: "MORTGAGE" } };
export const AFC: Story = { args: { type: "AFC" } };
export const Investment: Story = { args: { type: "INVESTMENT" } };
export const Crypto: Story = { args: { type: "CRYPTO" } };
