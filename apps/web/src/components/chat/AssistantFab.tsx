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
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand/90 hover:shadow-xl md:bottom-8 md:right-8"
    >
      <MessageSquare className="h-5 w-5 md:h-6 md:w-6" />
    </button>
  );
}
