import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CurrencyDisplay } from "./CurrencyDisplay";

const meta: Meta<typeof CurrencyDisplay> = {
  title: "Atoms/CurrencyDisplay",
  component: CurrencyDisplay,
};

export default meta;
type Story = StoryObj<typeof CurrencyDisplay>;

export const Default: Story = {
  args: { centavos: 425000000n },
};

export const Negative: Story = {
  args: { centavos: -85000000n },
};

export const Zero: Story = {
  args: { centavos: 0n },
};

export const LargeAmount: Story = {
  args: { centavos: 218450000000n },
};

export const USD: Story = {
  args: { centavos: 150000n, currency: "USD" },
};

export const ColorCodedPositive: Story = {
  args: { centavos: 420000000n, colorCode: true, showSign: true },
};

export const ColorCodedNegative: Story = {
  args: { centavos: -85000000n, colorCode: true, showSign: true },
};
