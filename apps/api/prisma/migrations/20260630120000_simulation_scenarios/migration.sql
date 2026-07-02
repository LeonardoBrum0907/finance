-- CreateTable
CREATE TABLE "SimulationScenario" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payload" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "linkedTransactionId" TEXT,
    "linkedInvestmentTxId" TEXT,
    "linkedGoalId" TEXT,
    "linkedCommitmentId" TEXT,
    "lastVerdict" TEXT,
    "lastImpactSnapshot" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationScenario_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "sourceSimulationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Goal_sourceSimulationId_key" ON "Goal"("sourceSimulationId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationScenario_linkedGoalId_key" ON "SimulationScenario"("linkedGoalId");

-- CreateIndex
CREATE INDEX "SimulationScenario_userId_idx" ON "SimulationScenario"("userId");

-- CreateIndex
CREATE INDEX "SimulationScenario_userId_status_idx" ON "SimulationScenario"("userId", "status");

-- CreateIndex
CREATE INDEX "SimulationScenario_personId_idx" ON "SimulationScenario"("personId");

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_sourceSimulationId_fkey" FOREIGN KEY ("sourceSimulationId") REFERENCES "SimulationScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationScenario" ADD CONSTRAINT "SimulationScenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationScenario" ADD CONSTRAINT "SimulationScenario_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationScenario" ADD CONSTRAINT "SimulationScenario_linkedTransactionId_fkey" FOREIGN KEY ("linkedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationScenario" ADD CONSTRAINT "SimulationScenario_linkedGoalId_fkey" FOREIGN KEY ("linkedGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
