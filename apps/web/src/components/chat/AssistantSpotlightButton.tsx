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
      className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border border-positive/20 bg-positive/10 px-2 py-1 text-[10px] font-semibold text-positive transition hover:bg-positive/15 ${className}`}
    >
      <Sparkles className="h-3 w-3" />
      {label}
    </button>
  );
}
