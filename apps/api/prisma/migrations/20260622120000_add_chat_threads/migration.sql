-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Nova conversa',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- Add threadId nullable first for backfill
ALTER TABLE "ChatMessage" ADD COLUMN "threadId" TEXT;

-- Backfill: one "Conversa" thread per user with existing messages
INSERT INTO "ChatThread" ("id", "title", "userId", "createdAt", "updatedAt")
SELECT
    'migrated_' || "userId",
    'Conversa',
    "userId",
    MIN("createdAt"),
    MAX("createdAt")
FROM "ChatMessage"
GROUP BY "userId";

UPDATE "ChatMessage" m
SET "threadId" = 'migrated_' || m."userId"
WHERE m."threadId" IS NULL
  AND EXISTS (SELECT 1 FROM "ChatThread" t WHERE t."id" = 'migrated_' || m."userId");

-- Make threadId required
ALTER TABLE "ChatMessage" ALTER COLUMN "threadId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ChatThread_userId_idx" ON "ChatThread"("userId");
CREATE INDEX "ChatMessage_threadId_idx" ON "ChatMessage"("threadId");

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
