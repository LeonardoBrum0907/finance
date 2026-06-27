-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiTokensUsedThisMonth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiUsagePeriod" TEXT;
