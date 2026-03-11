import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { db } from "./db";

// Postgres session storage is sufficient for a single-user app
// Reject storing sessions in Redis for simplicity
// TODO: Add social providers
export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    // No email verification
    // Single admin user, seeded manually
    autoSignIn: true,
  },
  plugins: [
    twoFactor({
      issuer: "Cuatro Finance",
    }),
  ],
  session: {
    cookieCache: {
      enabled: false,
      // maxAge: 5 * 60, // 5-minute cache reduces DB hits per request
    },
  },
});

export type Auth = typeof auth;
