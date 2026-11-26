import { useSearchParams } from "react-router-dom";
import { AppearanceSettings } from "../components/settings/AppearanceSettings";
import { DashboardWidgetsSettings } from "../components/settings/DashboardWidgetsSettings";
import { FamilySettings } from "../components/settings/FamilySettings";
import { ModulesSettings } from "../components/settings/ModulesSettings";

const TABS = [
  { id: "familia", label: "Família" },
  { id: "inicio", label: "Início" },
  { id: "modulos", label: "Módulos" },
  { id: "aparencia", label: "Aparência" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function parseTab(value: string | null): TabId {
  return TABS.some((tab) => tab.id === value) ? (value as TabId) : "familia";
}

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get("aba"));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Ajustes
      </h1>

      <div role="tablist" className="-mx-4 flex gap-1 overflow-x-auto border-b border-app-border px-4 sm:mx-0 sm:px-0">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setParams(item.id === "familia" ? {} : { aba: item.id }, { replace: true })}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm sm:px-4 font-medium transition ${
              tab === item.id
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "familia" && <FamilySettings />}
      {tab === "inicio" && <DashboardWidgetsSettings />}
      {tab === "modulos" && <ModulesSettings />}
      {tab === "aparencia" && <AppearanceSettings />}
    </div>
  );
}
