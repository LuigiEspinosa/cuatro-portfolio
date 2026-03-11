import { config } from "dotenv";
config({ path: ".env.local" });

// Prerequisites:
// 1. DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, ENCRYPTION_KEY set in env
// 2. pnpm prisma migrate deploy applied
async function main() {
  // Dynamic import inside the async fnction avois top-level await (CJS compat)
  const { auth } = await import("@/lib/auth");

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment");
  }

  try {
    await auth.api.signUpEmail({
      body: { email, password, name: "Admin" },
    });
    console.log(`Admin user created: ${email}`);
    console.log("Next step: log in and complete MFA setup at /setup-mfa");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.toLowerCase().includes("already exists") ||
      message.includes("422")
    ) {
      console.log(`User ${email} already exists - Skipping...`);
      return;
    }
    throw err;
  }
}

main().catch((err: unknown) => {
  console.log(err);
  process.exit(1);
});
