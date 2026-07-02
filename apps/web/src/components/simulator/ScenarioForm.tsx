import { useState } from "react";
import {
  DASHBOARD_CATEGORY_GROUPS,
  type SimulationInput,
  type SimulationPayload,
  type SimulationType,
  type SimulatorBaselineDTO,
} from "@finance/shared";
import { cardClass } from "../dashboard/motion";
import { SCENARIO_TYPE_TONE, SIMULATOR_TONE, scenarioTypeButtonClass } from "./tokens";

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
  {
    value: "invest",
    label: "Investimento",
    description: "Simular aporte único ou mensal em investimentos",
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
  investMode: "monthly" | "lump_sum";
}

export function buildSimulationPayloadFromForm(
  values: ScenarioFormValues,
): SimulationPayload | null {
  const parsedAmount = parseFloat(values.amount.replace(",", "."));
  if (isNaN(parsedAmount) || parsedAmount <= 0) return null;

  const payload: SimulationPayload = {
    type: values.type,
    name: values.name.trim() || undefined,
    amount: parsedAmount,
  };

  if (values.type === "single_purchase") {
    payload.paymentMethod = values.paymentMethod;
    if (values.paymentMethod === "credit" && values.creditAccountId) {
      payload.creditAccountId = values.creditAccountId;
    }
    if (values.categoryGroup) {
      payload.categoryGroup = values.categoryGroup as SimulationPayload["categoryGroup"];
    }
  }

  if (values.type === "installments") {
    const n = parseInt(values.installments, 10);
    if (!isNaN(n) && n >= 2) payload.installments = n;
    const rate = parseFloat(values.interestRate.replace(",", "."));
    if (!isNaN(rate) && rate >= 0) payload.interestRate = rate;
  }

  if (values.type === "recurring_expense") {
    const duration = parseInt(values.durationMonths, 10);
    if (!isNaN(duration) && duration >= 1) payload.durationMonths = duration;
  }

  if (values.type === "save_for_goal" && values.targetDate) {
    payload.targetDate = values.targetDate;
  }

  if (values.type === "invest") {
    payload.investMode = values.investMode;
    if (values.investMode === "monthly") {
      const duration = parseInt(values.durationMonths, 10);
      if (!isNaN(duration) && duration >= 1) payload.durationMonths = duration;
    }
  }

  return payload;
}

interface Props {
  baseline: SimulatorBaselineDTO;
  loading: boolean;
  hasResult?: boolean;
  onSubmit?: (input: SimulationInput) => void;
  onSave?: (payload: SimulationPayload, name: string) => void;
  onClear?: () => void;
  initialValues?: Partial<ScenarioFormValues>;
  submitLabel?: string;
  /** Sem card/header — uso dentro do modal */
  embedded?: boolean;
  /** Apenas salvar cenário, sem botão de simular */
  saveOnly?: boolean;
}

function defaultCreditAccountId(baseline: SimulatorBaselineDTO): string {
  return baseline.creditAccounts[0]?.id ?? "";
}

export function ScenarioForm({
  baseline,
  loading,
  hasResult = false,
  onSubmit,
  onSave,
  onClear,
  initialValues,
  submitLabel,
  embedded = false,
  saveOnly = false,
}: Props) {
  const [type, setType] = useState<SimulationType>(initialValues?.type ?? "single_purchase");
  const [name, setName] = useState(initialValues?.name ?? "");
  const [amount, setAmount] = useState(initialValues?.amount ?? "");
  const [installments, setInstallments] = useState(initialValues?.installments ?? "12");
  const [interestRate, setInterestRate] = useState(initialValues?.interestRate ?? "");
  const [durationMonths, setDurationMonths] = useState(initialValues?.durationMonths ?? "12");
  const [targetDate, setTargetDate] = useState(initialValues?.targetDate ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">(
    initialValues?.paymentMethod ?? "cash",
  );
  const [creditAccountId, setCreditAccountId] = useState(
    initialValues?.creditAccountId ?? baseline.creditAccounts[0]?.id ?? "",
  );
  const [categoryGroup, setCategoryGroup] = useState(initialValues?.categoryGroup ?? "");
  const [investMode, setInvestMode] = useState<"monthly" | "lump_sum">(
    initialValues?.investMode ?? "monthly",
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saveOnly) {
      handleSave();
      return;
    }
    const values: ScenarioFormValues = {
      type,
      name,
      amount,
      installments,
      interestRate,
      durationMonths,
      targetDate,
      paymentMethod,
      creditAccountId,
      categoryGroup,
      investMode,
    };
    const payload = buildSimulationPayloadFromForm(values);
    if (!payload) return;

    const input: SimulationInput = {
      ...payload,
      type: payload.type,
    };
    onSubmit?.(input);
  };

  const handleSave = () => {
    const values: ScenarioFormValues = {
      type,
      name,
      amount,
      installments,
      interestRate,
      durationMonths,
      targetDate,
      paymentMethod,
      creditAccountId,
      categoryGroup,
      investMode,
    };
    const payload = buildSimulationPayloadFromForm(values);
    if (!payload || !onSave) return;
    onSave(payload, name.trim() || "Novo cenário");
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
    setInvestMode("monthly");
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

  const Wrapper = embedded ? "div" : "section";
  const wrapperClass = embedded ? "space-y-4" : cardClass;

  return (
    <Wrapper className={wrapperClass}>
      {!embedded && (
        <div className="mb-4 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
          <h2 className="font-display text-sm font-semibold text-foreground">Monte seu cenário</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Simule o impacto antes de comprometer seu orçamento
          </p>
        </div>
      )}

      <div className={`grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 ${embedded ? "" : "mt-4"}`}>
        {SIMULATION_TYPES.map((item) => {
          const selected = type === item.value;
          const tone = SCENARIO_TYPE_TONE[item.value];
          const styles = SIMULATOR_TONE[tone];
          return (
          <button
            key={item.value}
            type="button"
            onClick={() => setType(item.value)}
            className={`cursor-pointer rounded-xl border px-3 py-3 text-left transition ${scenarioTypeButtonClass(item.value, selected)}`}
          >
            <p className={`text-xs font-semibold ${selected ? styles.value : "text-foreground"}`}>
              {item.label}
            </p>
            <p className={`mt-0.5 text-[10px] ${selected ? styles.label : "text-muted-foreground"}`}>
              {item.description}
            </p>
          </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={saveOnly ? "Nome do cenário" : "Nome do cenário (opcional)"}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: iPhone 16 Pro"
              className={inputClass}
              required={saveOnly}
            />
          </Field>

          <Field
            label={
              type === "recurring_expense"
                ? "Valor mensal (R$)"
                : type === "save_for_goal"
                  ? "Valor alvo (R$)"
                  : type === "invest" && investMode === "monthly"
                    ? "Aporte mensal (R$)"
                    : type === "invest"
                      ? "Aporte único (R$)"
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
              className={`cursor-pointer rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition ${
                amount === String(preset)
                  ? "border-positive/40 bg-positive/10 text-positive"
                  : "border-app-border text-muted-foreground hover:border-positive/30 hover:bg-positive/5 hover:text-positive"
              }`}
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

        {type === "invest" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de aporte">
              <select
                value={investMode}
                onChange={(e) => setInvestMode(e.target.value as "monthly" | "lump_sum")}
                className={inputClass}
              >
                <option value="monthly">Mensal recorrente</option>
                <option value="lump_sum">Valor único</option>
              </select>
            </Field>
            {investMode === "monthly" && (
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
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {saveOnly ? (
            <button
              type="submit"
              disabled={loading || !name.trim() || !amount}
              className="cursor-pointer rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-sm hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60 sm:px-8"
            >
              {loading ? "Salvando..." : "Salvar cenário"}
            </button>
          ) : (
            <>
              <button
                type="submit"
                disabled={loading || !onSubmit}
                className="cursor-pointer rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-sm hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60 sm:px-8"
              >
                {loading ? "Simulando..." : submitLabel ?? "Simular impacto"}
              </button>
              {onSave && (
                <button
                  type="button"
                  disabled={loading || !name.trim() || !amount}
                  onClick={handleSave}
                  className="cursor-pointer rounded-xl border border-brand/30 bg-brand/5 px-6 py-3 text-sm font-semibold text-brand hover:bg-brand/10 disabled:opacity-50"
                >
                  Salvar cenário
                </button>
              )}
            </>
          )}
          {!saveOnly && (
            <button
              type="button"
              onClick={handleClear}
              disabled={loading || (!hasValues && !hasResult)}
              className="cursor-pointer rounded-xl border border-app-border bg-app-surface px-6 py-3 text-sm font-semibold text-muted-foreground hover:border-app-border hover:bg-app-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              Limpar
            </button>
          )}
        </div>
      </form>
    </Wrapper>
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
