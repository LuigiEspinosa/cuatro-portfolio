import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // AD-10: an explicit pool ceiling. Two containers during a rollout hold at most ten, the `finance`
  // role's CONNECTION LIMIT in prisma/provision.sql.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 5 });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
