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
}

interface AssistantContextValue {
  isOpen: boolean;
  personId: string;
  prefillMessage: string;
  contextHint: string;
  source: string;
  pendingThreadId: string | null;
  openAssistant: (payload?: AssistantOpenPayload) => void;
  closeAssistant: () => void;
  consumePrefill: () => { message: string; contextHint: string };
  setPersonId: (id: string) => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [personId, setPersonId] = useState("");
  const [prefillMessage, setPrefillMessage] = useState("");
  const [contextHint, setContextHint] = useState("");
  const [source, setSource] = useState("");
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);

  const openAssistant = useCallback((payload?: AssistantOpenPayload) => {
    if (payload?.personId !== undefined) setPersonId(payload.personId);
    if (payload?.prefillMessage) setPrefillMessage(payload.prefillMessage);
    if (payload?.contextHint) setContextHint(payload.contextHint);
    if (payload?.source) setSource(payload.source);
    if (payload?.threadId) setPendingThreadId(payload.threadId);
    setIsOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
    setPrefillMessage("");
    setContextHint("");
    setSource("");
    setPendingThreadId(null);
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
        setIsOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      personId,
      prefillMessage,
      contextHint,
      source,
      pendingThreadId,
      openAssistant,
      closeAssistant,
      consumePrefill,
      setPersonId,
    }),
    [
      isOpen,
      personId,
      prefillMessage,
      contextHint,
      source,
      pendingThreadId,
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

export function openAssistantFromInsight(message: string, contextHint?: string) {
  return { prefillMessage: message, contextHint, source: "dashboard" } satisfies AssistantOpenPayload;
}
