interface Props {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export function ChatSuggestionChips({ suggestions, onSelect, disabled }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((text) => (
        <button
          key={text}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(text)}
          className="rounded-full border border-app-border bg-app-surface px-3 py-1 text-xs text-muted-foreground-dark hover:border-brand-300 hover:bg-brand/10 hover:text-brand disabled:opacity-60"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
