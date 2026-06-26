import { Sparkles } from "lucide-react";
import { useAssistant } from "../../lib/assistantContext";

interface Props {
  label?: string;
  message: string;
  contextKey: string;
  title?: string;
  contextHint?: string;
  personId?: string;
  className?: string;
}

export function AssistantSpotlightButton({
  label = "Perguntar",
  message,
  contextKey,
  title,
  contextHint,
  personId,
  className = "",
}: Props) {
  const { openAssistant } = useAssistant();

  return (
    <button
      type="button"
      onClick={() =>
        openAssistant({
          prefillMessage: message,
          contextHint,
          personId,
          source: "spotlight",
          contextKey,
          title: title ?? label,
        })
      }
      className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100 ${className}`}
    >
      <Sparkles className="h-3 w-3" />
      {label}
    </button>
  );
}
