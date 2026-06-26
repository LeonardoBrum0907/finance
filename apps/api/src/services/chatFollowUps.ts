import type { ChatSuggestionDTO } from "@finance/shared";

export function buildFollowUpSuggestions(
  userMessage: string,
  assistantMessage: string,
): ChatSuggestionDTO[] {
  const user = userMessage.toLowerCase();
  const assistant = assistantMessage.toLowerCase();
  const followUps: ChatSuggestionDTO[] = [];

  if (
    assistant.includes("categoria") ||
    assistant.includes("gast") ||
    user.includes("gast") ||
    user.includes("despesa")
  ) {
    followUps.push({
      label: "Criar meta de redução",
      message: "Com base nessa análise, proponha um objetivo para reduzir esses gastos",
      intent: "goal",
    });
    followUps.push({
      label: "Ver transações",
      message: "Liste as transações desse período com mais detalhes",
      intent: "analyze",
    });
  }

  if (
    assistant.includes("sobra") ||
    assistant.includes("saldo") ||
    assistant.includes("receita") ||
    user.includes("sobra")
  ) {
    followUps.push({
      label: "Criar plano de poupança",
      message: "Com essa sobra, ajude a montar um plano de poupança",
      intent: "plan",
    });
  }

  if (
    assistant.includes("objetivo") ||
    assistant.includes("meta") ||
    assistant.includes("plano") ||
    user.includes("objetivo") ||
    user.includes("meta")
  ) {
    followUps.push({
      label: "Registrar aporte",
      message: "Quero registrar um aporte em um dos meus objetivos",
      intent: "goal",
    });
    followUps.push({
      label: "Ver progresso",
      message: "Mostre o progresso dos meus objetivos e planos",
      intent: "analyze",
    });
  }

  if (
    assistant.includes("simula") ||
    assistant.includes("compra") ||
    assistant.includes("what-if") ||
    user.includes("comprar") ||
    user.includes("consigo")
  ) {
    followUps.push({
      label: "Ajustar valor",
      message: "E se eu reduzir o valor da compra pela metade?",
      intent: "what_if",
    });
    followUps.push({
      label: "Criar meta para isso",
      message: "Proponha um objetivo financeiro para essa compra",
      intent: "goal",
    });
  }

  if (followUps.length === 0) {
    followUps.push({
      label: "Detalhar mais",
      message: "Explique com mais detalhes e números",
      intent: "analyze",
    });
    followUps.push({
      label: "Próximo passo",
      message: "Qual ação prática você recomenda agora?",
      intent: "plan",
    });
  }

  const seen = new Set<string>();
  return followUps
    .filter((f) => {
      if (seen.has(f.message)) return false;
      seen.add(f.message);
      return true;
    })
    .slice(0, 3);
}
