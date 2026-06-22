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
      className="inline-flex max-w-full flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-1"
      role="group"
      aria-label="Filtrar por pessoa"
    >
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
          value === "all"
            ? "bg-white text-brand-700 shadow-sm"
            : "text-slate-600 hover:text-slate-800"
        }`}
      >
        Todos
      </button>
      {people.map((person) => (
        <button
          key={person.id}
          type="button"
          onClick={() => onChange(person.id)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            value === person.id
              ? "bg-white text-brand-700 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          {person.name}
        </button>
      ))}
    </div>
  );
}
