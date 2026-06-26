import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface AssistantOpenPayload {
  prefillMessage?: string;
  contextHint?: string;
  personId?: string;
  source?: string;
  threadId?: string;
  contextKey?: string;
  title?: string;
}

export type DashboardPersonFilter = "all" | string;

interface AssistantContextValue {
  isOpen: boolean;
  personId: string;
  dashboardPersonFilter: DashboardPersonFilter;
  prefillMessage: string;
  contextHint: string;
  source: string;
  pendingThreadId: string | null;
  pendingContextKey: string | null;
  pendingTitle: string | null;
  openAssistant: (payload?: AssistantOpenPayload) => void;
  closeAssistant: () => void;
  consumePrefill: () => { message: string; contextHint: string };
  setPersonId: (id: string) => void;
  setDashboardPersonFilter: (filter: DashboardPersonFilter) => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [personId, setPersonId] = useState("");
  const [dashboardPersonFilter, setDashboardPersonFilter] = useState<DashboardPersonFilter>("all");
  const [prefillMessage, setPrefillMessage] = useState("");
  const [contextHint, setContextHint] = useState("");
  const [source, setSource] = useState("");
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);
  const [pendingContextKey, setPendingContextKey] = useState<string | null>(null);
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);

  const openAssistant = useCallback((payload?: AssistantOpenPayload) => {
    if (payload?.personId !== undefined) {
      setPersonId(payload.personId);
    } else if (dashboardPersonFilter !== "all") {
      setPersonId(dashboardPersonFilter);
    }
    if (payload?.prefillMessage) setPrefillMessage(payload.prefillMessage);
    else setPrefillMessage("");
    if (payload?.contextHint) setContextHint(payload.contextHint);
    else setContextHint("");
    if (payload?.source) setSource(payload.source);
    else setSource("");

    if (payload?.threadId) {
      setPendingThreadId(payload.threadId);
      setPendingContextKey(null);
      setPendingTitle(null);
    } else if (payload?.contextKey) {
      setPendingThreadId(null);
      setPendingContextKey(payload.contextKey);
      setPendingTitle(payload.title ?? null);
    } else {
      setPendingThreadId(null);
      setPendingContextKey(null);
      setPendingTitle(null);
    }

    setIsOpen(true);
  }, [dashboardPersonFilter]);

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
    setPrefillMessage("");
    setContextHint("");
    setSource("");
    setPendingThreadId(null);
    setPendingContextKey(null);
    setPendingTitle(null);
  }, []);

  const consumePrefill = useCallback(() => {
    const result = { message: prefillMessage, contextHint };
    setPrefillMessage("");
    setContextHint("");
    return result;
  }, [prefillMessage, contextHint]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          closeAssistant();
        } else {
          openAssistant();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, openAssistant, closeAssistant]);

  const value = useMemo(
    () => ({
      isOpen,
      personId,
      dashboardPersonFilter,
      prefillMessage,
      contextHint,
      source,
      pendingThreadId,
      pendingContextKey,
      pendingTitle,
      openAssistant,
      closeAssistant,
      consumePrefill,
      setPersonId,
      setDashboardPersonFilter,
    }),
    [
      isOpen,
      personId,
      dashboardPersonFilter,
      prefillMessage,
      contextHint,
      source,
      pendingThreadId,
      pendingContextKey,
      pendingTitle,
      openAssistant,
      closeAssistant,
      consumePrefill,
    ],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant must be used within AssistantProvider");
  return ctx;
}

export function openAssistantFromInsight(
  message: string,
  contextHint?: string,
  contextKey = "dashboard:insight",
) {
  return {
    prefillMessage: message,
    contextHint,
    source: "dashboard",
    contextKey,
    title: "Insight do dashboard",
  } satisfies AssistantOpenPayload;
}
