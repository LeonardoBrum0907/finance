-- AlterTable
ALTER TABLE "ChatThread" ADD COLUMN "contextKey" TEXT;

-- Backfill: most recent "Resumo da semana" thread per user
UPDATE "ChatThread" t
SET "contextKey" = 'recap:weekly'
FROM (
  SELECT DISTINCT ON ("userId") id
  FROM "ChatThread"
  WHERE title = 'Resumo da semana'
  ORDER BY "userId", "updatedAt" DESC
) latest
WHERE t.id = latest.id;

-- CreateIndex
CREATE UNIQUE INDEX "ChatThread_userId_contextKey_key" ON "ChatThread"("userId", "contextKey");
