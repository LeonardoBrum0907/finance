-- Só acrescenta: colunas opcionais e um índice (a versão anterior da API roda neste banco).
ALTER TABLE "Transaction" ADD COLUMN "pluggyBillId" TEXT;
ALTER TABLE "BankConnection" ADD COLUMN "pluggyUpdatedAt" TIMESTAMP(3);
CREATE INDEX "Transaction_pluggyBillId_idx" ON "Transaction"("pluggyBillId");
