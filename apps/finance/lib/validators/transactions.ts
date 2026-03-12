import { z } from "zod";

const centavosFromString = z
  .string()
  .regex(/^-?\d+$/, "Must be an integer string (centavos)")
  .transform((s) => BigInt(s));

export const CreateTransactionScheme = z.object({
  // Positive = credit (money in), negative = debit (money out).
  amount_centavos: centavosFromString,
  currency: z.enum(["COP", "USD", "EUR", "BTC", "ETH", "USDT", "UVR"]),
  description: z.string().min(1).max(500),
  type: z.enum(["DEBIT", "CREDIT", "TRANSFER"]),
  transacted_at: z.iso.datetime().transform((s) => new Date(s)),
  notes: z.string().max(1000).optional(),
});

export type CreateTransactionInput = z.output<typeof CreateTransactionScheme>;
