-- CreateTable
CREATE TABLE "BudgetGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "limit" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetGroupMember" (
    "id" TEXT NOT NULL,
    "budgetGroupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryGroup" TEXT NOT NULL,

    CONSTRAINT "BudgetGroupMember_pkey" PRIMARY KEY ("id")
);

-- Migrate existing CategoryBudget rows
INSERT INTO "BudgetGroup" ("id", "userId", "name", "limit", "createdAt", "updatedAt")
SELECT
    "id",
    "userId",
    "group",
    "limit",
    "createdAt",
    "updatedAt"
FROM "CategoryBudget";

INSERT INTO "BudgetGroupMember" ("id", "budgetGroupId", "userId", "categoryGroup")
SELECT
    "id" || '_member',
    "id",
    "userId",
    "group"
FROM "CategoryBudget";

-- DropTable
DROP TABLE "CategoryBudget";

-- CreateIndex
CREATE INDEX "BudgetGroup_userId_idx" ON "BudgetGroup"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetGroup_userId_name_key" ON "BudgetGroup"("userId", "name");

-- CreateIndex
CREATE INDEX "BudgetGroupMember_budgetGroupId_idx" ON "BudgetGroupMember"("budgetGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetGroupMember_budgetGroupId_categoryGroup_key" ON "BudgetGroupMember"("budgetGroupId", "categoryGroup");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetGroupMember_userId_categoryGroup_key" ON "BudgetGroupMember"("userId", "categoryGroup");

-- AddForeignKey
ALTER TABLE "BudgetGroup" ADD CONSTRAINT "BudgetGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetGroupMember" ADD CONSTRAINT "BudgetGroupMember_budgetGroupId_fkey" FOREIGN KEY ("budgetGroupId") REFERENCES "BudgetGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
