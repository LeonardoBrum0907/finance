-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "trackingMode" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Goal" ADD COLUMN "lastSyncedBalance" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "GoalSource" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "accountId" TEXT,
    "investmentId" TEXT,
    "allocationPercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalSource_pkey" PRIMARY KEY ("id")
);

-- Migrate legacy linkedAccountId
INSERT INTO "GoalSource" ("id", "goalId", "sourceType", "accountId", "allocationPercent", "updatedAt")
SELECT
    'migrated_' || "id",
    "id",
    'account',
    "linkedAccountId",
    100,
    CURRENT_TIMESTAMP
FROM "Goal"
WHERE "linkedAccountId" IS NOT NULL;

UPDATE "Goal"
SET "trackingMode" = 'linked'
WHERE "linkedAccountId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "GoalSource_goalId_idx" ON "GoalSource"("goalId");
CREATE INDEX "GoalSource_accountId_idx" ON "GoalSource"("accountId");
CREATE INDEX "GoalSource_investmentId_idx" ON "GoalSource"("investmentId");
CREATE UNIQUE INDEX "GoalSource_goalId_accountId_key" ON "GoalSource"("goalId", "accountId");
CREATE UNIQUE INDEX "GoalSource_goalId_investmentId_key" ON "GoalSource"("goalId", "investmentId");

-- AddForeignKey
ALTER TABLE "GoalSource" ADD CONSTRAINT "GoalSource_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoalSource" ADD CONSTRAINT "GoalSource_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoalSource" ADD CONSTRAINT "GoalSource_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
