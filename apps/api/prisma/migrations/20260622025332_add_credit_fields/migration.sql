-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "availableCreditLimit" DOUBLE PRECISION,
ADD COLUMN     "balanceCloseDate" TIMESTAMP(3),
ADD COLUMN     "balanceDueDate" TIMESTAMP(3),
ADD COLUMN     "creditBrand" TEXT,
ADD COLUMN     "creditLevel" TEXT,
ADD COLUMN     "creditLimit" DOUBLE PRECISION,
ADD COLUMN     "minimumPayment" DOUBLE PRECISION;
