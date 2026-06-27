import type { ChatSuggestionDTO } from "@finance/shared";
import { ChatSuggestionChips } from "./ChatSuggestionChips";

interface Props {
  suggestions: ChatSuggestionDTO[];
  onSelect: (message: string) => void;
  disabled?: boolean;
}

export function FollowUpChips({ suggestions, onSelect, disabled }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <div className="mt-2">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground-dark">
        Continue com
      </p>
      <ChatSuggestionChips
        suggestions={suggestions.map((s) => s.label)}
        onSelect={(label) => {
          const match = suggestions.find((s) => s.label === label);
          onSelect(match?.message ?? label);
        }}
        disabled={disabled}
      />
    </div>
  );
}
