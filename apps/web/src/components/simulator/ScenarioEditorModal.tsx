import { useMemo } from "react";
import { X } from "lucide-react";
import type {
  CreateSimulationScenarioInput,
  SimulationPayload,
  SimulationScenarioDTO,
  SimulatorBaselineDTO,
  UpdateSimulationScenarioInput,
} from "@finance/shared";
import { Modal } from "../Modal";
import { ScenarioForm, type ScenarioFormValues } from "./ScenarioForm";

interface Props {
  open: boolean;
  baseline: SimulatorBaselineDTO;
  editing?: SimulationScenarioDTO | null;
  saving?: boolean;
  onClose: () => void;
  onCreate: (input: CreateSimulationScenarioInput) => void;
  onUpdate: (id: string, input: UpdateSimulationScenarioInput) => void;
}

function payloadToFormValues(payload: SimulationPayload): Partial<ScenarioFormValues> {
  return {
    type: payload.type,
    name: payload.name ?? "",
    amount: String(payload.amount),
    installments: String(payload.installments ?? 12),
    interestRate: payload.interestRate != null ? String(payload.interestRate) : "",
    durationMonths: String(payload.durationMonths ?? 12),
    targetDate: payload.targetDate ?? "",
    paymentMethod: payload.paymentMethod ?? "cash",
    creditAccountId: payload.creditAccountId ?? "",
    categoryGroup: payload.categoryGroup ?? "",
    investMode: payload.investMode ?? "monthly",
  };
}

export function ScenarioEditorModal({
  open,
  baseline,
  editing,
  saving,
  onClose,
  onCreate,
  onUpdate,
}: Props) {
  const initialValues = useMemo(
    () => (editing ? payloadToFormValues(editing.payload) : undefined),
    [editing],
  );

  if (!open) return null;

  return (
    <Modal
      onClose={onClose}
      disableBackdropClose={saving}
      panelClassName="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-app-border bg-app-surface p-6 shadow-2xl"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 cursor-pointer rounded-lg p-1 text-muted-foreground hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="h-4.5 w-4.5" />
      </button>

      <h3 className="mb-4 font-display text-lg font-bold text-foreground">
        {editing ? "Editar cenário" : "Novo cenário"}
      </h3>

      <ScenarioForm
        key={editing?.id ?? "new"}
        baseline={baseline}
        loading={Boolean(saving)}
        embedded
        saveOnly
        initialValues={initialValues}
        onSave={(payload, name) => {
          if (editing) {
            onUpdate(editing.id, {
              name: name || editing.name,
              payload,
              status: "active",
            });
          } else {
            onCreate({
              name: name || "Novo cenário",
              type: payload.type,
              status: "active",
              payload,
            });
          }
        }}
      />
    </Modal>
  );
}
