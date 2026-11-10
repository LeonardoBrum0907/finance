ALTER TABLE "PaymentCommitment" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "PaymentCommitment" ADD COLUMN "accountId" TEXT;
