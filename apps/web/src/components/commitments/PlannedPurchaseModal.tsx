import { useEffect, useState, type FormEvent } from "react";
import type { SimulationPayload, SimulationScenarioDTO } from "@finance/shared";
import { resolveSimulatedPaymentMethod, todayDateKeyInTimeZone } from "@finance/shared";
import { Modal } from "../Modal";

export interface PlannedCard {
  id: string;
  name: string;
}

type Method = "pix" | "credit_single" | "credit_installments";

const METHODS: { id: Method; label: string }[] = [
  { id: "pix", label: "Pix ou débito" },
  { id: "credit_single", label: "Cartão à vista" },
  { id: "credit_installments", label: "Cartão parcelado" },
];

const inputClass =
  "w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export interface PlannedPurchaseInput {
  name: string;
  type: SimulationPayload["type"];
  payload: SimulationPayload;
}

interface Props {
  open: boolean;
  cards: PlannedCard[];
  /** Compra em edição; sem ela, cria uma nova. */
  editing?: SimulationScenarioDTO | null;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (input: PlannedPurchaseInput) => void;
}

function parseAmount(value: string): number {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

/** Planejar uma compra: só o necessário para ver o impacto no caixa e na fatura. */
export function PlannedPurchaseModal({ open, cards, editing, saving, error, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("pix");
  const [installments, setInstallments] = useState("2");
  const [cardId, setCardId] = useState("");
  const [date, setDate] = useState(todayDateKeyInTimeZone());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const payload = editing?.payload;
    const editingMethod = payload ? resolveSimulatedPaymentMethod(payload) : "pix";
    setName(editing?.name ?? "");
    setAmount(payload ? String(payload.amount).replace(".", ",") : "");
    setMethod(editingMethod === "debit" ? "pix" : editingMethod);
    setInstallments(String(payload?.totalInstallments ?? payload?.installments ?? 2));
    setCardId(payload?.creditAccountId ?? cards[0]?.id ?? "");
    setDate(payload?.purchaseDate ?? todayDateKeyInTimeZone());
    setFormError(null);
  }, [open, editing, cards]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = parseAmount(amount);
    if (!name.trim()) return setFormError("Dê um nome para a compra.");
    if (!(value > 0)) return setFormError("Informe o valor.");
    const count = Number(installments);
    if (method === "credit_installments" && !(Number.isInteger(count) && count >= 2 && count <= 48)) {
      return setFormError("Parcelas de 2 a 48.");
    }
    setFormError(null);

    const parcelada = method === "credit_installments";
    const payload: SimulationPayload = {
      type: parcelada ? "installments" : "single_purchase",
      name: name.trim(),
      amount: value,
      paymentMethod: method === "pix" ? "cash" : "credit",
      paymentMethodDetail: method,
      purchaseDate: date,
      ...(method !== "pix" && cardId ? { creditAccountId: cardId } : {}),
      ...(parcelada ? { installments: count, totalInstallments: count, firstDueDate: date } : {}),
    };
    onSave({ name: name.trim(), type: payload.type, payload });
  }

  const usesCard = method !== "pix";

  if (!open) return null;

  return (
    <Modal onClose={onClose} disableBackdropClose={saving}>
      <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
        {editing ? "Editar compra planejada" : "Planejar compra"}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">O que</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Geladeira"
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Valor total</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Quando</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Como vai pagar</p>
          <div className="inline-flex flex-wrap rounded-lg border border-app-border bg-app-bg p-0.5">
            {METHODS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMethod(option.id)}
                disabled={option.id !== "pix" && cards.length === 0}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                  method === option.id
                    ? "bg-app-surface text-brand shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {usesCard && (
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Cartão</label>
                <select value={cardId} onChange={(e) => setCardId(e.target.value)} className={inputClass}>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {method === "credit_installments" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Parcelas</label>
                <input
                  type="number"
                  min={2}
                  max={48}
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-app-border/60 pt-4">
          {(formError || error) && <span className="mr-auto text-sm text-danger">{formError ?? error}</span>}
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60"
          >
            {saving ? "Salvando..." : editing ? "Salvar" : "Planejar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
