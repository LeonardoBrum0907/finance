import {
  addContributionSchema,
  createGoalSchema,
  createPlanSchema,
  updateGoalSchema,
  type ChatActionProposalType,
} from "@finance/shared";
import { z } from "zod";
import { prisma } from "../prisma.js";

function parseOptionalDate(value?: string | null): Date | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function applyChatProposal(
  userId: string,
  type: ChatActionProposalType,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (type) {
    case "create_goal": {
      const parsed = createGoalSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Proposta inválida");
      }
      const { name, description, type: goalType, icon, targetAmount, targetDate, linkedAccountId } =
        parsed.data;

      if (linkedAccountId) {
        const account = await prisma.account.findFirst({
          where: { id: linkedAccountId, connection: { person: { userId } } },
        });
        if (!account) throw new Error("Conta vinculada não encontrada");
      }

      await prisma.goal.create({
        data: {
          userId,
          name,
          description,
          type: goalType,
          icon,
          targetAmount,
          targetDate: parseOptionalDate(targetDate),
          linkedAccountId: linkedAccountId ?? null,
        },
      });
      return;
    }

    case "update_goal": {
      const schema = updateGoalSchema.extend({ goalId: z.string().min(1) });
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Proposta inválida");
      }

      const { goalId, linkedAccountId, targetDate, ...rest } = parsed.data;
      const existing = await prisma.goal.findFirst({ where: { id: goalId, userId } });
      if (!existing) throw new Error("Objetivo não encontrado");

      if (linkedAccountId) {
        const account = await prisma.account.findFirst({
          where: { id: linkedAccountId, connection: { person: { userId } } },
        });
        if (!account) throw new Error("Conta vinculada não encontrada");
      }

      await prisma.goal.update({
        where: { id: goalId },
        data: {
          ...rest,
          ...(targetDate !== undefined ? { targetDate: parseOptionalDate(targetDate) } : {}),
          ...(linkedAccountId !== undefined ? { linkedAccountId } : {}),
        },
      });
      return;
    }

    case "add_contribution": {
      const schema = addContributionSchema.extend({ goalId: z.string().min(1) });
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Proposta inválida");
      }

      const { goalId, amount, date, note } = parsed.data;
      const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
      if (!goal) throw new Error("Objetivo não encontrado");

      const contributionDate = date ? new Date(date) : new Date();

      await prisma.$transaction(async (tx) => {
        await tx.goalContribution.create({
          data: {
            goalId,
            amount,
            date: contributionDate,
            source: "ai",
            note: note ?? null,
          },
        });
        await tx.goal.update({
          where: { id: goalId },
          data: {
            currentAmount: { increment: amount },
            status:
              goal.currentAmount + amount >= goal.targetAmount ? "completed" : goal.status,
          },
        });
      });
      return;
    }

    case "create_plan": {
      const parsed = createPlanSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Proposta inválida");
      }

      const { name, description, monthlyContribution, goals } = parsed.data;
      const goalIds = goals.map((g) => g.goalId);
      const count = await prisma.goal.count({
        where: { userId, id: { in: goalIds } },
      });
      if (count !== goalIds.length) {
        throw new Error("Um ou mais objetivos não foram encontrados");
      }

      await prisma.plan.create({
        data: {
          userId,
          name,
          description,
          monthlyContribution,
          members: {
            create: goals.map((member) => ({
              goalId: member.goalId,
              monthlyAllocation: member.monthlyAllocation,
            })),
          },
        },
      });
      return;
    }

    default:
      throw new Error("Tipo de proposta desconhecido");
  }
}

export interface ExtractedProposal {
  type: ChatActionProposalType;
  payload: Record<string, unknown>;
}

export function extractProposalFromToolOutput(output: unknown): ExtractedProposal | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  if (record.proposal !== true || typeof record.type !== "string") return null;
  if (!record.payload || typeof record.payload !== "object") return null;

  const type = record.type as ChatActionProposalType;
  if (
    type !== "create_goal" &&
    type !== "update_goal" &&
    type !== "create_plan" &&
    type !== "add_contribution"
  ) {
    return null;
  }

  return {
    type,
    payload: record.payload as Record<string, unknown>,
  };
}

export function extractProposalFromSteps(
  steps: Array<{ toolResults?: Array<{ output?: unknown; result?: unknown }> }>,
): ExtractedProposal | null {
  for (const step of steps) {
    for (const toolResult of step.toolResults ?? []) {
      const output = toolResult.output ?? toolResult.result;
      const proposal = extractProposalFromToolOutput(output);
      if (proposal) return proposal;
    }
  }
  return null;
}

export function serializeProposal(proposal: {
  id: string;
  type: string;
  payload: unknown;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
}) {
  return {
    id: proposal.id,
    type: proposal.type,
    payload: proposal.payload as Record<string, unknown>,
    status: proposal.status,
    createdAt: proposal.createdAt.toISOString(),
    resolvedAt: proposal.resolvedAt?.toISOString() ?? null,
  };
}
