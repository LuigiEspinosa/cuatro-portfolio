import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000",
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = "/verify-mfa";
      },
    }),
  ],
});
