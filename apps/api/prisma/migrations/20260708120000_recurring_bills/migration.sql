-- CreateTable
CREATE TABLE "RecurringBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personId" TEXT,
    "accountId" TEXT,
    "title" TEXT NOT NULL,
    "payeeName" TEXT,
    "matchSignature" TEXT NOT NULL,
    "category" TEXT,
    "expectedAmount" DOUBLE PRECISION NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'auto_detected',
    "lastOccurrenceDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringBillOccurrence" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "cycleKey" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "transactionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringBillOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringBill_userId_idx" ON "RecurringBill"("userId");

-- CreateIndex
CREATE INDEX "RecurringBill_status_idx" ON "RecurringBill"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringBill_userId_matchSignature_accountId_key" ON "RecurringBill"("userId", "matchSignature", "accountId");

-- CreateIndex
CREATE INDEX "RecurringBillOccurrence_billId_idx" ON "RecurringBillOccurrence"("billId");

-- CreateIndex
CREATE INDEX "RecurringBillOccurrence_status_idx" ON "RecurringBillOccurrence"("status");

-- CreateIndex
CREATE INDEX "RecurringBillOccurrence_dueDate_idx" ON "RecurringBillOccurrence"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringBillOccurrence_billId_cycleKey_key" ON "RecurringBillOccurrence"("billId", "cycleKey");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringBillOccurrence_transactionId_key" ON "RecurringBillOccurrence"("transactionId");

-- AddForeignKey
ALTER TABLE "RecurringBill" ADD CONSTRAINT "RecurringBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringBill" ADD CONSTRAINT "RecurringBill_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringBill" ADD CONSTRAINT "RecurringBill_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringBillOccurrence" ADD CONSTRAINT "RecurringBillOccurrence_billId_fkey" FOREIGN KEY ("billId") REFERENCES "RecurringBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringBillOccurrence" ADD CONSTRAINT "RecurringBillOccurrence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
