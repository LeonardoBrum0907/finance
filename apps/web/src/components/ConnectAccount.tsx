import { useState } from "react";
import { PluggyConnect } from "react-pluggy-connect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PersonDTO } from "@finance/shared";
import { api } from "../lib/api";

interface Props {
  people: PersonDTO[];
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
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Cadastre uma pessoa na aba <strong>Pessoas</strong> antes de conectar uma conta.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Conectar conta de
          </label>
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
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
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {startMutation.isPending ? "Abrindo..." : "Conectar conta bancária"}
        </button>
      </div>

      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}

      {token && (
        <PluggyConnect
          connectToken={token}
          includeSandbox
          onSuccess={(itemData) => {
            setToken(null);
            const itemId = itemData?.item?.id;
            if (itemId) saveMutation.mutate(itemId);
          }}
          onError={() => {
            setToken(null);
            setMessage("Não foi possível conectar. Tente novamente.");
          }}
          onClose={() => setToken(null)}
        />
      )}
    </div>
  );
}
