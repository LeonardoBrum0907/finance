import { MessageSquare } from "lucide-react";
import { useAssistant } from "../../lib/assistantContext";

export function AssistantFab() {
  const { isOpen, openAssistant, closeAssistant } = useAssistant();

  return (
    <button
      type="button"
      onClick={() => (isOpen ? closeAssistant() : openAssistant())}
      aria-label={isOpen ? "Fechar assistente" : "Abrir assistente (Ctrl+K)"}
      title="Assistente (Ctrl+K)"
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 hover:shadow-xl md:bottom-8 md:right-8"
    >
      <MessageSquare className="h-6 w-6" />
    </button>
  );
}
