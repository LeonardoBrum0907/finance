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
      label: "Ver transações",
      message: "Liste as transações desse período com mais detalhes",
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
      intent: "analyze",
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
