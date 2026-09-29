import { z } from "zod";

// JSON doesn't support BigInt. Amouns are sent as integer strings
//        and transformed to BigInt by Zod.
const centavosFromString = z
  .string()
  .regex(/^-?\d+$/, "Must be an integer string (centavos)")
  .transform((s) => BigInt(s));

export const CreateAccountSchema = z.object({
  name: z.string().min(1).max(100),
  institution: z.string().min(1).max(100),
  type: z.enum([
    "SAVINGS",
    "CHECKING",
    "CREDIT_CARD",
    "LOAN",
    "MORTGAGE",
    "AFC",
    "INVESTMENT",
    "CRYPTO",
  ]),
  currency: z.enum(["COP", "USD", "EUR", "BTC", "ETH", "USDT", "UVR"]),
  balance_centavos: centavosFromString,
  is_afc: z.boolean().default(false),
  is_uvr_mortgage: z.boolean().default(false),
  uvr_balance: z
    .string()
    .regex(/^\d+\.?\d*$/, "Must be a positive decima string")
    .optional(),
});

export const UpdateAccountSchema = CreateAccountSchema.partial();

export type CreateAccountInput = z.output<typeof CreateAccountSchema>;
export type UpdateAccountInput = z.output<typeof UpdateAccountSchema>;
