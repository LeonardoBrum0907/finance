import { generateText } from "ai";
import { prisma } from "../prisma.js";
import { buildFinancialContext, getModel, SYSTEM_PROMPT } from "./ai.js";
import { buildGoalsContextBlock } from "./finance/goalsContext.js";

const RECAP_PROMPT = `Gere um resumo semanal conciso das finanças do usuário em português do Brasil.
Use markdown leve (títulos ## e listas). Inclua:
1. Destaques de receitas e despesas
2. Categoria que mais cresceu ou dominou
3. Situação da sobra/saldo
4. Status dos objetivos (se houver)
5. Uma ação prática recomendada para a próxima semana
Seja direto, amigável e baseado APENAS nos dados fornecidos. Máximo 300 palavras.`;

export async function createWeeklyRecap(userId: string): Promise<{
  threadId: string;
  preview: string;
  content: string;
  createdAt: string;
}> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const existing = await prisma.chatThread.findFirst({
    where: {
      userId,
      title: "Resumo da semana",
      updatedAt: { gte: weekAgo },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (existing && existing.messages[0]) {
    const content = existing.messages[0].content;
    const preview = content.slice(0, 160);
    return {
      threadId: existing.id,
      content,
      preview: preview.length < content.length ? `${preview}…` : preview,
      createdAt: existing.updatedAt.toISOString(),
    };
  }

  const [context, goalsContext] = await Promise.all([
    buildFinancialContext(userId),
    buildGoalsContextBlock(userId),
  ]);

  const { text } = await generateText({
    model: getModel(),
    system: `${SYSTEM_PROMPT}\n\n${RECAP_PROMPT}`,
    prompt: `# Dados financeiros\n${context}\n\n# ${goalsContext}`,
  });

  const thread = await prisma.chatThread.create({
    data: { userId, title: "Resumo da semana" },
  });

  await prisma.chatMessage.create({
    data: {
      userId,
      threadId: thread.id,
      role: "assistant",
      content: text,
      metadata: { dataPeriod: "semana" },
    } as Parameters<typeof prisma.chatMessage.create>[0]["data"],
  });

  const preview = text.slice(0, 160);
  return {
    threadId: thread.id,
    content: text,
    preview: preview.length < text.length ? `${preview}…` : preview,
    createdAt: new Date().toISOString(),
  };
}
