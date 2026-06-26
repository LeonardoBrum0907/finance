-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "pluggyCategory" TEXT,
ADD COLUMN "userCategory" TEXT,
ADD COLUMN "categorySource" TEXT,
ADD COLUMN "categoryConfidence" DOUBLE PRECISION,
ADD COLUMN "merchantName" TEXT;

-- CreateTable
CREATE TABLE "CategoryMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CategoryMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryMapping_userId_idx" ON "CategoryMapping"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryMapping_userId_pattern_key" ON "CategoryMapping"("userId", "pattern");

-- AddForeignKey
ALTER TABLE "CategoryMapping" ADD CONSTRAINT "CategoryMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
