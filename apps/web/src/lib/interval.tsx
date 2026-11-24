import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { IntervalKind, IntervalRef } from "@finance/shared";

/**
 * Intervalo escolhido no app (ciclo da fatura ou mês). É a fonte única: o painel,
 * a lista e os blocos leem daqui e mandam o mesmo `interval` para a API, para nenhum
 * componente ficar num período diferente quando a regra mudar (24/11/2026).
 */
interface IntervalState {
  /** Escolha da pessoa; null até ela escolher (cada página usa o seu padrão). */
  interval: IntervalRef | null;
  setInterval: (ref: IntervalRef) => void;
}

const STORAGE_KEY = "finance.interval";
const IntervalContext = createContext<IntervalState | null>(null);

// Só o tipo fica guardado no aparelho: o mês é sempre o atual ao abrir o app.
function readStoredKind(): IntervalKind | null {
  try {
    const kind = window.localStorage.getItem(STORAGE_KEY);
    return kind === "bill" || kind === "month" ? kind : null;
  } catch {
    return null;
  }
}

function storeKind(kind: IntervalKind): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, kind);
  } catch {
    // Sem armazenamento (aba anônima): a escolha vale só nesta visita.
  }
}

export function IntervalProvider({ children }: { children: ReactNode }) {
  const [interval, setIntervalState] = useState<IntervalRef | null>(null);
  const [storedKind] = useState(readStoredKind);

  const setInterval = useCallback((ref: IntervalRef) => {
    setIntervalState(ref);
    storeKind(ref.kind);
  }, []);

  const value = useMemo<IntervalState>(
    () => ({
      interval: interval ?? (storedKind ? { kind: storedKind, key: "" } : null),
      setInterval,
    }),
    [interval, storedKind, setInterval],
  );

  return <IntervalContext.Provider value={value}>{children}</IntervalContext.Provider>;
}

/** Intervalo escolhido no app. @example const { interval, setInterval } = useInterval(); */
export function useInterval(): IntervalState {
  const state = useContext(IntervalContext);
  if (!state) throw new Error("useInterval precisa estar dentro de <IntervalProvider>.");
  return state;
}
