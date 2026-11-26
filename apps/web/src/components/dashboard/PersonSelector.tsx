import type { PersonDTO } from "@finance/shared";

export type PersonFilter = "all" | string;

interface Props {
  value: PersonFilter;
  people: PersonDTO[];
  onChange: (value: PersonFilter) => void;
}

export function PersonSelector({ value, people, onChange }: Props) {
  if (people.length <= 1) return null;

  return (
    <div
      className="inline-flex max-w-full overflow-x-auto rounded-lg border border-app-border bg-app-bg p-1"
      role="group"
      aria-label="Filtrar por pessoa"
    >
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
          value === "all"
            ? "bg-app-surface text-brand shadow-sm"
            : "text-muted-foreground-dark hover:text-foreground"
        }`}
      >
        Todos
      </button>
      {people.map((person) => (
        <button
          key={person.id}
          type="button"
          onClick={() => onChange(person.id)}
          className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
            value === person.id
              ? "bg-app-surface text-brand shadow-sm"
              : "text-muted-foreground-dark hover:text-foreground"
          }`}
        >
          {person.name}
        </button>
      ))}
    </div>
  );
}
