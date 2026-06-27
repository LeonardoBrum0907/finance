-- CreateTable
CREATE TABLE "PaymentCommitment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payeeName" TEXT,
    "notes" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "installmentAmount" DOUBLE PRECISION NOT NULL,
    "totalInstallments" INTEGER NOT NULL,
    "dayOfMonth" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "anchorTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentInstallment" (
    "id" TEXT NOT NULL,
    "commitmentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "transactionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCommitment_anchorTransactionId_key" ON "PaymentCommitment"("anchorTransactionId");

-- CreateIndex
CREATE INDEX "PaymentCommitment_userId_idx" ON "PaymentCommitment"("userId");

-- CreateIndex
CREATE INDEX "PaymentCommitment_status_idx" ON "PaymentCommitment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentInstallment_transactionId_key" ON "PaymentInstallment"("transactionId");

-- CreateIndex
CREATE INDEX "PaymentInstallment_commitmentId_idx" ON "PaymentInstallment"("commitmentId");

-- CreateIndex
CREATE INDEX "PaymentInstallment_status_idx" ON "PaymentInstallment"("status");

-- CreateIndex
CREATE INDEX "PaymentInstallment_dueDate_idx" ON "PaymentInstallment"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentInstallment_commitmentId_sequence_key" ON "PaymentInstallment"("commitmentId", "sequence");

-- AddForeignKey
ALTER TABLE "PaymentCommitment" ADD CONSTRAINT "PaymentCommitment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCommitment" ADD CONSTRAINT "PaymentCommitment_anchorTransactionId_fkey" FOREIGN KEY ("anchorTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstallment" ADD CONSTRAINT "PaymentInstallment_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "PaymentCommitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstallment" ADD CONSTRAINT "PaymentInstallment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
