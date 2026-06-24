-- AlterTable
ALTER TABLE "User" ADD COLUMN "paydayDay" INTEGER,
ADD COLUMN "defaultPeriodMode" TEXT NOT NULL DEFAULT 'calendar';
