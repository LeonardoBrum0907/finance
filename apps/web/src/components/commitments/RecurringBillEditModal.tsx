import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { PersonDTO, RecurringBillDTO, UpdateRecurringBillInput } from "@finance/shared";
import { DASHBOARD_CATEGORY_GROUPS } from "@finance/shared";
import { Modal } from "../Modal";

interface Props {
  open: boolean;
  bill: RecurringBillDTO | null;
  people: PersonDTO[];
  saving?: boolean;
  onClose: () => void;
  onSave: (id: string, body: UpdateRecurringBillInput) => void;
}

export function RecurringBillEditModal({
  open,
  bill,
  people,
  saving,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [personId, setPersonId] = useState<string>("");

  useEffect(() => {
    if (!bill) return;
    setTitle(bill.title);
    setCategory(bill.category ?? "");
    setExpectedAmount(String(bill.expectedAmount));
    setDayOfMonth(String(bill.dayOfMonth));
    setPersonId(bill.personId ?? "");
  }, [bill]);

  if (!open || !bill) return null;

  return (
    <Modal
      onClose={onClose}
      disableBackdropClose={saving}
      panelClassName="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-app-border bg-app-surface p-6 shadow-2xl"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 cursor-pointer rounded-lg p-1 text-muted-foreground hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="h-4.5 w-4.5" />
      </button>

      <h3 className="mb-4 font-display text-lg font-bold text-foreground">Editar conta fixa</h3>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const amount = parseFloat(expectedAmount.replace(",", "."));
          const day = parseInt(dayOfMonth, 10);
          if (isNaN(amount) || amount <= 0 || isNaN(day)) return;
          onSave(bill.id, {
            title: title.trim() || bill.title,
            category: category || null,
            expectedAmount: amount,
            dayOfMonth: day,
            personId: personId || null,
          });
        }}
      >
        <Field label="Nome">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor esperado (R$)">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={expectedAmount}
              onChange={(e) => setExpectedAmount(e.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Dia do vencimento">
            <input
              type="number"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              className={inputClass}
              required
            />
          </Field>
        </div>

        <Field label="Categoria">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          >
            <option value="">Nenhuma</option>
            {DASHBOARD_CATEGORY_GROUPS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </Field>

        {people.length > 0 && (
          <Field label="Pessoa">
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className={inputClass}
            >
              <option value="">Não atribuída</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-app-border px-6 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-app-bg"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-app-border bg-app-bg/50 px-3 py-2 text-xs text-foreground outline-brand focus:border-brand focus:bg-app-surface";
