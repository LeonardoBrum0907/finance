import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PersonDTO } from "@finance/shared";
import { api } from "../lib/api";
import { ConnectAccount } from "../components/ConnectAccount";
import { ConnectionCard } from "../components/accounts/ConnectionCard";

export function AccountsPage() {
  const queryClient = useQueryClient();

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const syncMutation = useMutation({
    mutationFn: (connectionId: string) =>
      api.post(`/api/connections/${connectionId}/sync`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const removeConnection = useMutation({
    mutationFn: (connectionId: string) =>
      api.delete(`/api/connections/${connectionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const peopleList = people.data ?? [];
  const hasPeople = peopleList.length > 0;
  const hasConnections = peopleList.some((p) => p.connections.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Contas</h1>
        <p className="text-sm text-muted-foreground-dark">
          Conecte e gerencie contas bancárias. Uma mesma pessoa pode ter vários
          bancos (ex.: Itaú e Nubank).
        </p>
      </div>

      {!hasPeople ? (
        <div className="rounded-lg border border-dashed border-app-border bg-app-surface p-6 text-center">
          <p className="text-sm font-medium text-foreground/90">
            Cadastre uma pessoa antes de conectar contas
          </p>
          <p className="mt-1 text-sm text-muted-foreground-dark">
            Vá em{" "}
            <Link to="/pessoas" className="font-medium text-brand hover:underline">
              Pessoas
            </Link>{" "}
            para adicionar quem faz parte do seu orçamento.
          </p>
        </div>
      ) : (
        <>
          <ConnectAccount people={peopleList} />

          {hasConnections ? (
            <div className="space-y-4">
              {peopleList.map((person) => {
                if (person.connections.length === 0) return null;

                return (
                  <div
                    key={person.id}
                    className="rounded-lg border border-app-border bg-app-surface p-4"
                  >
                    <div className="mb-3">
                      <p className="font-medium text-foreground">{person.name}</p>
                      {person.relationship && (
                        <p className="text-xs text-muted-foreground-dark">{person.relationship}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {person.connections.map((conn) => (
                        <ConnectionCard
                          key={conn.id}
                          connection={conn}
                          onSync={(id) => syncMutation.mutate(id)}
                          onDisconnect={(id) => removeConnection.mutate(id)}
                          syncing={
                            syncMutation.isPending &&
                            syncMutation.variables === conn.id
                          }
                          disconnecting={
                            removeConnection.isPending &&
                            removeConnection.variables === conn.id
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-app-border bg-app-surface p-6 text-center">
              <p className="text-sm font-medium text-foreground/90">
                Nenhuma conta conectada ainda
              </p>
              <p className="mt-1 text-sm text-muted-foreground-dark">
                Use o botão acima para conectar o primeiro banco.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
