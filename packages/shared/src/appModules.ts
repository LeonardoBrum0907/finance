import { z } from "zod";

/**
 * Módulos opcionais do app. O núcleo (Início, Compromissos e Ajustes) aparece sempre;
 * cada módulo daqui só aparece no menu, nas rotas e na tela quando está ligado.
 */
export const APP_MODULE_IDS = ["investments", "assistant"] as const;

export type AppModuleId = (typeof APP_MODULE_IDS)[number];

export type AppModulesState = Record<AppModuleId, boolean>;

export interface AppModuleDefinition {
  id: AppModuleId;
  title: string;
  description: string;
  /** Rota da página do módulo (sem página própria quando ausente). */
  path?: string;
  defaultEnabled: boolean;
}

export const APP_MODULES: readonly AppModuleDefinition[] = [
  {
    id: "investments",
    title: "Investimentos",
    description: "Carteira, alocação e rendimento das aplicações conectadas.",
    path: "/investimentos",
    defaultEnabled: false,
  },
  {
    id: "assistant",
    title: "Assistente IA",
    description: "Chat que responde perguntas sobre as suas finanças.",
    path: "/chat",
    defaultEnabled: false,
  },
] as const;

export function isAppModuleId(value: string): value is AppModuleId {
  return (APP_MODULE_IDS as readonly string[]).includes(value);
}

const appModulesPatchShape = Object.fromEntries(
  APP_MODULE_IDS.map((id) => [id, z.boolean().optional()]),
) as Record<AppModuleId, z.ZodOptional<z.ZodBoolean>>;

export const appModulesPatchSchema = z.object(appModulesPatchShape).strict();

export type AppModulesPatch = z.infer<typeof appModulesPatchSchema>;

/** Extrai só pares id→boolean conhecidos; ignora ids e valores inválidos. */
export function parseStoredAppModules(stored: unknown): Partial<AppModulesState> {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const result: Partial<AppModulesState> = {};
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    if (isAppModuleId(key) && typeof value === "boolean") result[key] = value;
  }
  return result;
}

/** Une o JSON persistido com o registro. Módulos novos usam defaultEnabled. */
export function resolveAppModules(stored: unknown): AppModulesState {
  const defaults = Object.fromEntries(
    APP_MODULES.map((module) => [module.id, module.defaultEnabled]),
  ) as AppModulesState;
  return { ...defaults, ...parseStoredAppModules(stored) };
}

export function mergeAppModulesPatch(
  stored: unknown,
  patch: AppModulesPatch,
): Partial<AppModulesState> {
  const next: Partial<AppModulesState> = { ...parseStoredAppModules(stored) };
  for (const [key, value] of Object.entries(patch)) {
    if (isAppModuleId(key) && typeof value === "boolean") next[key] = value;
  }
  return next;
}
