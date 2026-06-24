import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PersonDTO } from "@finance/shared";
import { api } from "../lib/api";
import { useConfirm } from "../lib/confirm";

function countAccounts(person: PersonDTO): number {
  return person.connections.reduce((sum, conn) => sum + conn.accounts.length, 0);
}

function formatConnectionsBadge(person: PersonDTO): string {
  const banks = person.connections.length;
  const accounts = countAccounts(person);

  if (banks === 0) return "Nenhuma conta conectada";

  const bankLabel = banks === 1 ? "1 banco" : `${banks} bancos`;
  const accountLabel = accounts === 1 ? "1 conta" : `${accounts} contas`;
  return `${bankLabel} · ${accountLabel}`;
}

export function PeoplePage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRelationship, setEditRelationship] = useState("");

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

  const updateMutation = useMutation({
    mutationFn: ({ id, name: n, relationship: r }: { id: string; name: string; relationship: string }) =>
      api.put<PersonDTO>(`/api/people/${id}`, {
        name: n,
        relationship: r || undefined,
      }),
    onSuccess: () => {
      setEditingId(null);
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) createMutation.mutate();
  }

  function startEditing(person: PersonDTO) {
    setEditingId(person.id);
    setEditName(person.name);
    setEditRelationship(person.relationship ?? "");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setEditRelationship("");
  }

  function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    updateMutation.mutate({
      id: editingId,
      name: editName.trim(),
      relationship: editRelationship.trim(),
    });
  }

  async function handleDelete(person: PersonDTO) {
    const hasConnections = person.connections.length > 0;
    const message = hasConnections
      ? `Remover "${person.name}"? Isso também desconectará ${person.connections.length} banco(s) e apagará todas as contas e transações vinculadas.`
      : `Remover "${person.name}"?`;

    const ok = await confirm({
      title: "Remover pessoa",
      message,
      confirmLabel: "Remover",
      variant: "danger",
    });
    if (ok) deleteMutation.mutate(person.id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Pessoas</h1>
        <p className="text-sm text-slate-500">
          Cadastre quem faz parte do seu orçamento familiar (você, cônjuge, filhos, etc.).
          As contas bancárias são conectadas na página{" "}
          <Link to="/contas" className="font-medium text-brand-600 hover:underline">
            Contas
          </Link>
          .
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
            {editingId === person.id ? (
              <form onSubmit={handleEditSubmit} className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nome</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Relação (opcional)
                  </label>
                  <input
                    value={editRelationship}
                    onChange={(e) => setEditRelationship(e.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-800">{person.name}</p>
                  {person.relationship && (
                    <p className="text-xs text-slate-500">{person.relationship}</p>
                  )}
                  <Link
                    to="/contas"
                    className="mt-2 inline-block text-xs text-brand-600 hover:underline"
                  >
                    {formatConnectionsBadge(person)}
                  </Link>
                </div>
                <div className="flex shrink-0 gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => startEditing(person)}
                    className="text-brand-600 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(person)}
                    disabled={deleteMutation.isPending}
                    className="text-red-600 hover:underline disabled:opacity-60"
                  >
                    Remover
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {people.data?.length === 0 && (
          <p className="text-sm text-slate-500">Nenhuma pessoa cadastrada ainda.</p>
        )}
      </div>
    </div>
  );
}
