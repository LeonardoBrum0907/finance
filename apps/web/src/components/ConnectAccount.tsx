import { useState } from "react";
import { PluggyConnect } from "react-pluggy-connect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PersonDTO } from "@finance/shared";
import { api } from "../lib/api";

interface Props {
  people: PersonDTO[];
}

type PluggyConnectError = {
  message?: string;
  data?: {
    item?: {
      error?: {
        code?: string;
        message?: string;
        providerMessage?: string;
      };
    };
  };
};

const PLUGGY_ERROR_HINTS: Record<string, string> = {
  TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED:
    "Sua conta Pluggy está no plano trial e não permite conectar bancos reais (ex.: Itaú). " +
    "Use o conector sandbox \"Pluggy Bank\" para testar, ou faça upgrade em dashboard.pluggy.ai.",
  CREATE_ITEMS_API_FREE_DISABLED:
    "Seu plano Pluggy não permite criar conexões com bancos reais. Use o sandbox ou faça upgrade do plano.",
  SANDBOX_CLIENT_ITEM:
    "Esta conta Pluggy só permite conexões sandbox. Selecione \"Pluggy Bank\" no widget.",
  INVALID_CREDENTIALS: "CPF inválido ou não corresponde à conta do Itaú.",
  USER_AUTHORIZATION_NOT_GRANTED:
    "Você recusou o consentimento no Itaú. Tente novamente e autorize o compartilhamento.",
  USER_AUTHORIZATION_REVOKED:
    "O consentimento foi revogado no Itaú. Reconecte e autorize novamente.",
  USER_INPUT_TIMEOUT:
    "O tempo para concluir a autorização no Itaú expirou. Tente de novo sem fechar a janela.",
  SITE_NOT_AVAILABLE: "O Itaú está instável no momento. Tente novamente mais tarde.",
  CONNECTION_ERROR: "Erro de conexão com o Itaú. Verifique sua internet e tente de novo.",
};

function extractErrorCode(error: PluggyConnectError): string | undefined {
  const itemCode = error.data?.item?.error?.code;
  if (itemCode) return itemCode;

  const raw = error.message ?? "";
  const match = raw.match(/[A-Z][A-Z0-9_]{3,}/);
  return match?.[0];
}

function formatPluggyError(error: PluggyConnectError): string {
  const code = extractErrorCode(error);
  const hint = code ? PLUGGY_ERROR_HINTS[code] : undefined;
  const itemError = error.data?.item?.error;
  const detail =
    itemError?.providerMessage ?? itemError?.message ?? error.message ?? null;

  if (hint) return hint;
  if (detail && detail !== code) return detail;
  return "Não foi possível conectar. Tente novamente.";
}

export function ConnectAccount({ people }: Props) {
  const queryClient = useQueryClient();
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const pluggyStatus = useQuery({
    queryKey: ["pluggy-status"],
    queryFn: () => api.get<{ configured: boolean }>("/api/pluggy/status"),
  });

  const startMutation = useMutation({
    mutationFn: () =>
      api.post<{ accessToken: string }>("/api/pluggy/connect-token"),
    onSuccess: (data) => {
      setMessage(null);
      if (!data.accessToken) {
        setMessage("A API não retornou um connect token. Verifique se a API está rodando.");
        return;
      }
      setToken(data.accessToken);
    },
    onError: (err: Error) => {
      if (err.message.includes("503") || err.message.includes("não configurado")) {
        setMessage(
          "Pluggy não configurado. Preencha PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET em apps/api/.env e reinicie a API.",
        );
        return;
      }
      setMessage(err.message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (itemId: string) =>
      api.post("/api/connections", { personId, itemId }),
    onSuccess: () => {
      setMessage("Conta conectada e sincronizada!");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  if (pluggyStatus.data && !pluggyStatus.data.configured) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        A integração com o Open Finance (Pluggy) não está configurada no servidor.
        Defina <code>PLUGGY_CLIENT_ID</code> e <code>PLUGGY_CLIENT_SECRET</code> no
        arquivo <code>.env</code> da API.
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <div className="rounded-lg border border-app-border bg-app-surface p-4 text-sm text-muted-foreground-dark">
        Cadastre uma pessoa na aba <strong>Pessoas</strong> antes de conectar uma conta.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-app-border bg-app-surface p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground/90">
            Conectar conta de
          </label>
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="rounded-md border border-app-border px-3 py-2 text-sm focus:border-brand focus:outline-none"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending || !personId}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
        >
          {startMutation.isPending ? "Abrindo..." : "Conectar conta bancária"}
        </button>
      </div>

      {message && <p className="mt-3 text-sm text-muted-foreground-dark">{message}</p>}

      {token && (
        <PluggyConnect
          connectToken={token}
          includeSandbox
          forceOauthInBrowser
          language="pt"
          onSuccess={(itemData) => {
            setToken(null);
            const itemId = itemData?.item?.id;
            if (itemId) saveMutation.mutate(itemId);
          }}
          onError={(error) => {
            setToken(null);
            console.error("Pluggy Connect error:", error);
            setMessage(formatPluggyError(error));
          }}
          onLoadError={(error) => {
            setToken(null);
            console.error("Pluggy Connect load error:", error);
            setMessage(
              "Não foi possível abrir o widget da Pluggy. Verifique bloqueadores de popup e tente novamente.",
            );
          }}
          onClose={() => setToken(null)}
        />
      )}
    </div>
  );
}
