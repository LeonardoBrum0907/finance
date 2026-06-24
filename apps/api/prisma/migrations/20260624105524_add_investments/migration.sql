-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "pluggyInvestmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "subtype" TEXT,
    "code" TEXT,
    "isin" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION,
    "amountOriginal" DOUBLE PRECISION,
    "amountProfit" DOUBLE PRECISION,
    "amountWithdrawal" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "value" DOUBLE PRECISION,
    "rate" DOUBLE PRECISION,
    "rateType" TEXT,
    "annualRate" DOUBLE PRECISION,
    "lastMonthRate" DOUBLE PRECISION,
    "lastTwelveMonthsRate" DOUBLE PRECISION,
    "currencyCode" TEXT NOT NULL DEFAULT 'BRL',
    "purchaseDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "owner" TEXT,
    "connectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentTransaction" (
    "id" TEXT NOT NULL,
    "pluggyInvestmentTransactionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "tradeDate" TIMESTAMP(3),
    "type" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "netAmount" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "value" DOUBLE PRECISION,
    "description" TEXT,
    "movementType" TEXT,
    "investmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Investment_pluggyInvestmentId_key" ON "Investment"("pluggyInvestmentId");

-- CreateIndex
CREATE INDEX "Investment_connectionId_idx" ON "Investment"("connectionId");

-- CreateIndex
CREATE INDEX "Investment_status_idx" ON "Investment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentTransaction_pluggyInvestmentTransactionId_key" ON "InvestmentTransaction"("pluggyInvestmentTransactionId");

-- CreateIndex
CREATE INDEX "InvestmentTransaction_investmentId_idx" ON "InvestmentTransaction"("investmentId");

-- CreateIndex
CREATE INDEX "InvestmentTransaction_date_idx" ON "InvestmentTransaction"("date");

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BankConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
