-- DropForeignKey
ALTER TABLE "ManagedAccount" DROP CONSTRAINT "ManagedAccount_linkedGoalId_fkey";

-- DropForeignKey
ALTER TABLE "BudgetGroup" DROP CONSTRAINT "BudgetGroup_userId_fkey";

-- DropForeignKey
ALTER TABLE "BudgetGroupMember" DROP CONSTRAINT "BudgetGroupMember_budgetGroupId_fkey";

-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_userId_fkey";

-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_sourceSimulationId_fkey";

-- DropForeignKey
ALTER TABLE "GoalSource" DROP CONSTRAINT "GoalSource_goalId_fkey";

-- DropForeignKey
ALTER TABLE "GoalSource" DROP CONSTRAINT "GoalSource_accountId_fkey";

-- DropForeignKey
ALTER TABLE "GoalSource" DROP CONSTRAINT "GoalSource_investmentId_fkey";

-- DropForeignKey
ALTER TABLE "GoalContribution" DROP CONSTRAINT "GoalContribution_goalId_fkey";

-- DropForeignKey
ALTER TABLE "Plan" DROP CONSTRAINT "Plan_userId_fkey";

-- DropForeignKey
ALTER TABLE "PlanGoal" DROP CONSTRAINT "PlanGoal_planId_fkey";

-- DropForeignKey
ALTER TABLE "PlanGoal" DROP CONSTRAINT "PlanGoal_goalId_fkey";

-- DropForeignKey
ALTER TABLE "SimulationScenario" DROP CONSTRAINT "SimulationScenario_linkedGoalId_fkey";

-- DropForeignKey
ALTER TABLE "ChatActionProposal" DROP CONSTRAINT "ChatActionProposal_userId_fkey";

-- DropForeignKey
ALTER TABLE "ChatActionProposal" DROP CONSTRAINT "ChatActionProposal_threadId_fkey";

-- DropForeignKey
ALTER TABLE "ChatActionProposal" DROP CONSTRAINT "ChatActionProposal_messageId_fkey";

-- DropIndex
DROP INDEX "ManagedAccount_linkedGoalId_key";

-- DropIndex
DROP INDEX "SimulationScenario_linkedGoalId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "defaultPeriodMode";

-- AlterTable
ALTER TABLE "ManagedAccount" DROP COLUMN "linkedGoalId";

-- AlterTable
ALTER TABLE "SimulationScenario" DROP COLUMN "linkedGoalId";

-- DropTable
DROP TABLE "BudgetGroup";

-- DropTable
DROP TABLE "BudgetGroupMember";

-- DropTable
DROP TABLE "Goal";

-- DropTable
DROP TABLE "GoalSource";

-- DropTable
DROP TABLE "GoalContribution";

-- DropTable
DROP TABLE "Plan";

-- DropTable
DROP TABLE "PlanGoal";

-- DropTable
DROP TABLE "ChatActionProposal";

