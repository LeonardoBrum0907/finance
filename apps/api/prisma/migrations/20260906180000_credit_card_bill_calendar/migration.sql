-- AlterTable
ALTER TABLE "Account" ADD COLUMN "billCloseDay" INTEGER;
ALTER TABLE "Account" ADD COLUMN "billDueDay" INTEGER;

-- CreateTable
CREATE TABLE "CreditCardBill" (
    "id" TEXT NOT NULL,
    "pluggyBillId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "closingDate" TIMESTAMP(3),
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "minimumPaymentAmount" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'pluggy',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCardBill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardBill_pluggyBillId_key" ON "CreditCardBill"("pluggyBillId");

-- CreateIndex
CREATE INDEX "CreditCardBill_accountId_dueDate_idx" ON "CreditCardBill"("accountId", "dueDate");

-- AddForeignKey
ALTER TABLE "CreditCardBill" ADD CONSTRAINT "CreditCardBill_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
