-- AlterTable
ALTER TABLE "auth_session" ADD COLUMN     "twoFactorVerified" BOOLEAN DEFAULT false;
