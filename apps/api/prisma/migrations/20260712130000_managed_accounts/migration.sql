-- CreateTable
CREATE TABLE "ManagedAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personId" TEXT,
    "title" TEXT NOT NULL,
    "payeeName" TEXT,
    "category" TEXT,
    "notes" TEXT,
    "kind" TEXT NOT NULL,
    "simulationType" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expectedAmount" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION,
    "totalInstallments" INTEGER,
    "dayOfMonth" INTEGER,
    "matchSignature" TEXT,
    "anchorTransactionId" TEXT,
    "bankAccountId" TEXT,
    "linkedGoalId" TEXT,
    "linkedTransactionId" TEXT,
    "simulationPayload" JSONB,
    "lastVerdict" TEXT,
    "lastImpactSnapshot" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "lastOccurrenceDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "legacyRecurringBillId" TEXT,
    "legacyCommitmentId" TEXT,
    "legacySimulationScenarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedAccountEntry" (
    "id" TEXT NOT NULL,
    "managedAccountId" TEXT NOT NULL,
    "sequence" INTEGER,
    "cycleKey" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "transactionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedAccountEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagedAccount_anchorTransactionId_key" ON "ManagedAccount"("anchorTransactionId");
CREATE UNIQUE INDEX "ManagedAccount_linkedGoalId_key" ON "ManagedAccount"("linkedGoalId");
CREATE UNIQUE INDEX "ManagedAccount_legacyRecurringBillId_key" ON "ManagedAccount"("legacyRecurringBillId");
CREATE UNIQUE INDEX "ManagedAccount_legacyCommitmentId_key" ON "ManagedAccount"("legacyCommitmentId");
CREATE UNIQUE INDEX "ManagedAccount_legacySimulationScenarioId_key" ON "ManagedAccount"("legacySimulationScenarioId");
CREATE INDEX "ManagedAccount_userId_idx" ON "ManagedAccount"("userId");
CREATE INDEX "ManagedAccount_userId_status_idx" ON "ManagedAccount"("userId", "status");
CREATE INDEX "ManagedAccount_personId_idx" ON "ManagedAccount"("personId");
CREATE INDEX "ManagedAccount_kind_idx" ON "ManagedAccount"("kind");

CREATE UNIQUE INDEX "ManagedAccountEntry_transactionId_key" ON "ManagedAccountEntry"("transactionId");
CREATE UNIQUE INDEX "ManagedAccountEntry_managedAccountId_cycleKey_key" ON "ManagedAccountEntry"("managedAccountId", "cycleKey");
CREATE UNIQUE INDEX "ManagedAccountEntry_managedAccountId_sequence_key" ON "ManagedAccountEntry"("managedAccountId", "sequence");
CREATE INDEX "ManagedAccountEntry_managedAccountId_idx" ON "ManagedAccountEntry"("managedAccountId");
CREATE INDEX "ManagedAccountEntry_status_idx" ON "ManagedAccountEntry"("status");
CREATE INDEX "ManagedAccountEntry_dueDate_idx" ON "ManagedAccountEntry"("dueDate");

-- AddForeignKey
ALTER TABLE "ManagedAccount" ADD CONSTRAINT "ManagedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedAccount" ADD CONSTRAINT "ManagedAccount_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManagedAccount" ADD CONSTRAINT "ManagedAccount_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManagedAccount" ADD CONSTRAINT "ManagedAccount_anchorTransactionId_fkey" FOREIGN KEY ("anchorTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManagedAccount" ADD CONSTRAINT "ManagedAccount_linkedGoalId_fkey" FOREIGN KEY ("linkedGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ManagedAccountEntry" ADD CONSTRAINT "ManagedAccountEntry_managedAccountId_fkey" FOREIGN KEY ("managedAccountId") REFERENCES "ManagedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedAccountEntry" ADD CONSTRAINT "ManagedAccountEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
