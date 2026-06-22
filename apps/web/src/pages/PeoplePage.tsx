import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PersonDTO } from "@finance/shared";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";

export function PeoplePage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<PersonDTO>("/api/people", {
        name,
        relationship: relationship || undefined,
      }),
    onSuccess: () => {
      setName("");
      setRelationship("");
      queryClient.invalidateQueries({ queryKey: ["people"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/people/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) createMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Pessoas</h1>
        <p className="text-sm text-slate-500">
          Cadastre as pessoas cujas contas você quer acompanhar (você, cônjuge, etc.).
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Maria"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Relação (opcional)
          </label>
          <input
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="Ex: Esposa"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Adicionar
        </button>
      </form>

      <div className="space-y-4">
        {people.data?.map((person) => (
          <div
            key={person.id}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">{person.name}</p>
                {person.relationship && (
                  <p className="text-xs text-slate-500">{person.relationship}</p>
                )}
              </div>
              <button
                onClick={() => deleteMutation.mutate(person.id)}
                className="text-sm text-red-600 hover:underline"
              >
                Remover
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {person.connections.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma conta conectada.</p>
              ) : (
                person.connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="rounded-md border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {conn.connectorImageUrl && (
                          <img
                            src={conn.connectorImageUrl}
                            alt=""
                            className="h-6 w-6 rounded"
                          />
                        )}
                        <span className="text-sm font-medium text-slate-700">
                          {conn.connectorName ?? "Instituição"}
                        </span>
                        <span className="text-xs text-slate-400">{conn.status}</span>
                      </div>
                      <div className="flex gap-3 text-xs">
                        <button
                          onClick={() => syncMutation.mutate(conn.id)}
                          className="text-brand-600 hover:underline"
                        >
                          Sincronizar
                        </button>
                        <button
                          onClick={() => removeConnection.mutate(conn.id)}
                          className="text-red-600 hover:underline"
                        >
                          Desconectar
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {conn.accounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="flex justify-between text-sm text-slate-600"
                        >
                          <span>{acc.name}</span>
                          <span>{formatCurrency(acc.balance, acc.currencyCode)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
        {people.data?.length === 0 && (
          <p className="text-sm text-slate-500">Nenhuma pessoa cadastrada ainda.</p>
        )}
      </div>
    </div>
  );
}
