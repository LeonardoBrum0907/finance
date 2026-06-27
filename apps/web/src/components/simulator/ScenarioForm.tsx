import { useState } from "react";
import {
  DASHBOARD_CATEGORY_GROUPS,
  type SimulationInput,
  type SimulationType,
  type SimulatorBaselineDTO,
} from "@finance/shared";
import { cardClass } from "../dashboard/motion";

const SIMULATION_TYPES: { value: SimulationType; label: string; description: string }[] = [
  {
    value: "single_purchase",
    label: "Compra pontual",
    description: "Impacto de uma compra à vista ou no crédito",
  },
  {
    value: "installments",
    label: "Parcelada",
    description: "Compra dividida em parcelas mensais",
  },
  {
    value: "recurring_expense",
    label: "Despesa recorrente",
    description: "Nova despesa fixa mensal",
  },
  {
    value: "save_for_goal",
    label: "Poupar para objetivo",
    description: "Quanto tempo ou esforço para atingir um valor",
  },
];

const AMOUNT_PRESETS = [500, 2000, 5000, 8000];

export interface ScenarioFormValues {
  type: SimulationType;
  name: string;
  amount: string;
  installments: string;
  interestRate: string;
  durationMonths: string;
  targetDate: string;
  paymentMethod: "cash" | "credit";
  creditAccountId: string;
  categoryGroup: string;
}

interface Props {
  baseline: SimulatorBaselineDTO;
  loading: boolean;
  hasResult?: boolean;
  onSubmit: (input: SimulationInput) => void;
  onClear?: () => void;
}

function defaultCreditAccountId(baseline: SimulatorBaselineDTO): string {
  return baseline.creditAccounts[0]?.id ?? "";
}

export function ScenarioForm({ baseline, loading, hasResult = false, onSubmit, onClear }: Props) {
  const [type, setType] = useState<SimulationType>("single_purchase");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("12");
  const [interestRate, setInterestRate] = useState("");
  const [durationMonths, setDurationMonths] = useState("12");
  const [targetDate, setTargetDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">("cash");
  const [creditAccountId, setCreditAccountId] = useState(
    baseline.creditAccounts[0]?.id ?? "",
  );
  const [categoryGroup, setCategoryGroup] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const input: SimulationInput = {
      type,
      name: name.trim() || undefined,
      amount: parsedAmount,
    };

    if (type === "single_purchase") {
      input.paymentMethod = paymentMethod;
      if (paymentMethod === "credit" && creditAccountId) {
        input.creditAccountId = creditAccountId;
      }
      if (categoryGroup) input.categoryGroup = categoryGroup as SimulationInput["categoryGroup"];
    }

    if (type === "installments") {
      const n = parseInt(installments, 10);
      if (!isNaN(n) && n >= 2) input.installments = n;
      const rate = parseFloat(interestRate.replace(",", "."));
      if (!isNaN(rate) && rate >= 0) input.interestRate = rate;
    }

    if (type === "recurring_expense") {
      const duration = parseInt(durationMonths, 10);
      if (!isNaN(duration) && duration >= 1) input.durationMonths = duration;
    }

    if (type === "save_for_goal" && targetDate) {
      input.targetDate = targetDate;
    }

    onSubmit(input);
  };

  const handleClear = () => {
    setType("single_purchase");
    setName("");
    setAmount("");
    setInstallments("12");
    setInterestRate("");
    setDurationMonths("12");
    setTargetDate("");
    setPaymentMethod("cash");
    setCreditAccountId(defaultCreditAccountId(baseline));
    setCategoryGroup("");
    onClear?.();
  };

  const hasValues =
    name.trim() !== "" ||
    amount !== "" ||
    interestRate !== "" ||
    targetDate !== "" ||
    categoryGroup !== "" ||
    type !== "single_purchase" ||
    paymentMethod !== "cash" ||
    installments !== "12" ||
    durationMonths !== "12";

  return (
    <section className={cardClass}>
      <h2 className="font-display text-sm font-semibold text-foreground">Monte seu cenário</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Simule o impacto antes de comprometer seu orçamento
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SIMULATION_TYPES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setType(item.value)}
            className={`cursor-pointer rounded-xl border px-3 py-3 text-left transition ${
              type === item.value
                ? "border-positive/40 bg-positive/10 ring-1 ring-positive/20"
                : "border-app-border bg-app-surface hover:border-app-border"
            }`}
          >
            <p className="text-xs font-semibold text-foreground">{item.label}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{item.description}</p>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do cenário (opcional)">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: iPhone 16 Pro"
              className={inputClass}
            />
          </Field>

          <Field
            label={
              type === "recurring_expense"
                ? "Valor mensal (R$)"
                : type === "save_for_goal"
                  ? "Valor alvo (R$)"
                  : "Valor (R$)"
            }
          >
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              required
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          {AMOUNT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              className="cursor-pointer rounded-lg border border-app-border px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:border-positive/30 hover:text-positive"
            >
              R$ {preset.toLocaleString("pt-BR")}
            </button>
          ))}
        </div>

        {type === "single_purchase" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Forma de pagamento">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as "cash" | "credit")}
                  className={inputClass}
                >
                  <option value="cash">Débito / PIX / à vista</option>
                  <option value="credit">Cartão de crédito</option>
                </select>
              </Field>

              {paymentMethod === "credit" && baseline.creditAccounts.length > 0 && (
                <Field label="Cartão">
                  <select
                    value={creditAccountId}
                    onChange={(e) => setCreditAccountId(e.target.value)}
                    className={inputClass}
                  >
                    {baseline.creditAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.personName})
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Categoria (opcional)">
                <select
                  value={categoryGroup}
                  onChange={(e) => setCategoryGroup(e.target.value)}
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
            </div>
          </>
        )}

        {type === "installments" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nº de parcelas">
              <input
                type="number"
                min="2"
                max="48"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Juros ao mês (%) — opcional">
              <input
                type="number"
                step="0.01"
                min="0"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </Field>
          </div>
        )}

        {type === "recurring_expense" && (
          <Field label="Duração (meses)">
            <input
              type="number"
              min="1"
              max="120"
              value={durationMonths}
              onChange={(e) => setDurationMonths(e.target.value)}
              className={inputClass}
            />
          </Field>
        )}

        {type === "save_for_goal" && (
          <Field label="Prazo desejado (opcional)">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className={inputClass}
            />
          </Field>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-sm hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60 sm:px-8"
          >
            {loading ? "Simulando..." : "Simular impacto"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={loading || (!hasValues && !hasResult)}
            className="cursor-pointer rounded-xl border border-app-border bg-app-surface px-6 py-3 text-sm font-semibold text-muted-foreground hover:border-app-border hover:bg-app-bg disabled:cursor-not-allowed disabled:opacity-50"
          >
            Limpar
          </button>
        </div>
      </form>
    </section>
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
