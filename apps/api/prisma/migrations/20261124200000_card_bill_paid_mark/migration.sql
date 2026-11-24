-- CreateTable
CREATE TABLE "CardBillPaidMark" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "billMonth" TEXT NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardBillPaidMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardBillPaidMark_accountId_billMonth_key" ON "CardBillPaidMark"("accountId", "billMonth");

-- AddForeignKey
ALTER TABLE "CardBillPaidMark" ADD CONSTRAINT "CardBillPaidMark_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
