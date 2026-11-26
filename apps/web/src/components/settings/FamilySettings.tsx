import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus } from "lucide-react";
import type { PaydayCycleAnchor, PersonDTO, UpdateCreditAccountInput } from "@finance/shared";
import { describePaydayCycleBounds } from "@finance/shared";
import { api } from "../../lib/api";
import { useConfirm } from "../../lib/confirm";
import { ConnectAccount } from "../ConnectAccount";
import { ConnectionCard } from "../accounts/ConnectionCard";

const inputClass =
  "rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

interface PersonDraft {
  name: string;
  relationship: string;
  paydayDay: string;
  paydayCycleAnchor: PaydayCycleAnchor;
}

function draftFrom(person: PersonDTO): PersonDraft {
  return {
    name: person.name,
    relationship: person.relationship ?? "",
    paydayDay: person.paydayDay?.toString() ?? "",
    paydayCycleAnchor: person.paydayCycleAnchor,
  };
}

function invalidateFinance(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["people"] });
  queryClient.invalidateQueries({ queryKey: ["settings"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
}

/** Pessoas da família, o dia de salário de cada uma e os bancos conectados, numa tela só. */
export function FamilySettings() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [newName, setNewName] = useState("");
  const [newRelationship, setNewRelationship] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PersonDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const people = useQuery({
    queryKey: ["people"],
    queryFn: () => api.get<PersonDTO[]>("/api/people"),
  });

  const createPerson = useMutation({
    mutationFn: () =>
      api.post<PersonDTO>("/api/people", {
        name: newName.trim(),
        relationship: newRelationship.trim() || undefined,
      }),
    onSuccess: () => {
      setNewName("");
      setNewRelationship("");
      invalidateFinance(queryClient);
    },
  });

  const updatePerson = useMutation({
    mutationFn: ({ id, body }: { id: string; body: PersonDraft }) =>
      api.put<PersonDTO>(`/api/people/${id}`, {
        name: body.name.trim(),
        relationship: body.relationship.trim() || undefined,
        paydayDay: body.paydayDay.trim() === "" ? null : Number(body.paydayDay),
        paydayCycleAnchor: body.paydayCycleAnchor,
      }),
    onSuccess: () => {
      setEditingId(null);
      setDraft(null);
      invalidateFinance(queryClient);
    },
  });

  const deletePerson = useMutation({
    mutationFn: (id: string) => api.delete(`/api/people/${id}`),
    onSuccess: () => invalidateFinance(queryClient),
  });

  const syncConnection = useMutation({
    mutationFn: (connectionId: string) => api.post(`/api/connections/${connectionId}/sync`),
    onSuccess: () => invalidateFinance(queryClient),
  });

  const removeConnection = useMutation({
    mutationFn: (connectionId: string) => api.delete(`/api/connections/${connectionId}`),
    onSuccess: () => invalidateFinance(queryClient),
  });

  const saveBillCalendar = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCreditAccountInput }) =>
      api.patch(`/api/accounts/${id}`, body),
    onSuccess: () => invalidateFinance(queryClient),
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (newName.trim()) createPerson.mutate();
  }

  function startEditing(person: PersonDTO) {
    setFormError(null);
    setEditingId(person.id);
    setDraft(draftFrom(person));
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !draft) return;
    if (!draft.name.trim()) {
      setFormError("Informe o nome.");
      return;
    }
    const day = draft.paydayDay.trim();
    if (day !== "" && !(Number(day) >= 1 && Number(day) <= 31 && Number.isInteger(Number(day)))) {
      setFormError("O dia do salário vai de 1 a 31.");
      return;
    }
    setFormError(null);
    updatePerson.mutate({ id: editingId, body: draft });
  }

  async function handleDelete(person: PersonDTO) {
    const banks = person.connections.length;
    const ok = await confirm({
      title: "Remover pessoa",
      message:
        banks > 0
          ? `Remover "${person.name}"? Isso também desconecta ${banks} banco(s) e apaga as contas e transações dele(a).`
          : `Remover "${person.name}"?`,
      confirmLabel: "Remover",
      variant: "danger",
    });
    if (ok) deletePerson.mutate(person.id);
  }

  if (people.isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }
  if (people.isError) {
    return <p className="text-sm text-danger">Não foi possível carregar a família.</p>;
  }

  const list = people.data ?? [];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Quem faz parte da casa, o dia em que cada um recebe e os bancos de cada um.
      </p>

      <div className="space-y-4">
        {list.map((person) => {
          const editing = editingId === person.id && draft;
          return (
            <div
              key={person.id}
              className="rounded-xl border border-app-border bg-app-surface p-4 shadow-xs"
            >
              {editing ? (
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Nome
                      </label>
                      <input
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Relação (opcional)
                      </label>
                      <input
                        value={draft.relationship}
                        onChange={(e) => setDraft({ ...draft, relationship: e.target.value })}
                        placeholder="Ex.: Esposa"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Dia do salário
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={draft.paydayDay}
                        onChange={(e) => setDraft({ ...draft, paydayDay: e.target.value })}
                        placeholder="Ex.: 25"
                        className={`${inputClass} w-28`}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">O salário é o…</p>
                    <div className="mt-1.5 inline-flex rounded-lg border border-app-border bg-app-surface p-0.5">
                      {(
                        [
                          { id: "end", label: "Último dia do ciclo" },
                          { id: "start", label: "Primeiro dia do ciclo" },
                        ] as const
                      ).map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setDraft({ ...draft, paydayCycleAnchor: option.id })}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                            draft.paydayCycleAnchor === option.id
                              ? "bg-brand/10 text-brand"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {describePaydayCycleBounds(draft.paydayDay || "X", draft.paydayCycleAnchor)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={updatePerson.isPending}
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60"
                    >
                      {updatePerson.isPending ? "Salvando..." : "Salvar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setDraft(null);
                        setFormError(null);
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                    {(formError || updatePerson.isError) && (
                      <span className="text-sm text-danger">
                        {formError ?? (updatePerson.error as Error).message}
                      </span>
                    )}
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">
                      {person.name}
                      {person.relationship && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          ({person.relationship})
                        </span>
                      )}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {person.paydayDay
                        ? `Salário dia ${person.paydayDay}`
                        : "Dia do salário não informado"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => startEditing(person)}
                      className="text-brand hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(person)}
                      disabled={deletePerson.isPending}
                      className="text-danger hover:underline disabled:opacity-60"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              )}

              {person.connections.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-app-border/60 pt-4">
                  {person.connections.map((conn) => (
                    <ConnectionCard
                      key={conn.id}
                      connection={conn}
                      onSync={(id) => syncConnection.mutate(id)}
                      onDisconnect={(id) => removeConnection.mutate(id)}
                      onSaveBillCalendar={(id, body) => saveBillCalendar.mutate({ id, body })}
                      syncing={syncConnection.isPending && syncConnection.variables === conn.id}
                      disconnecting={
                        removeConnection.isPending && removeConnection.variables === conn.id
                      }
                      savingAccountId={
                        saveBillCalendar.isPending ? (saveBillCalendar.variables?.id ?? null) : null
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-app-border bg-app-surface p-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex.: Maria"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Relação (opcional)
          </label>
          <input
            value={newRelationship}
            onChange={(e) => setNewRelationship(e.target.value)}
            placeholder="Ex.: Esposa"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={createPerson.isPending || !newName.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 px-4 py-2 text-sm font-medium text-brand transition hover:bg-brand/5 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Adicionar pessoa
        </button>
      </form>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground/90">Conectar um banco</p>
        <ConnectAccount people={list} />
      </div>
    </div>
  );
}
