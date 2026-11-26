import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appModulesPatchSchema,
  mergeAppModulesPatch,
  resolveAppModules,
} from "./appModules";

test("sem nada salvo, todos os módulos começam desligados", () => {
  assert.deepEqual(resolveAppModules(null), {
    investments: false,
    assistant: false,
  });
});

test("usa o que foi salvo e ignora ids e valores inválidos", () => {
  const state = resolveAppModules({ assistant: true, investments: "sim", legacy: true });
  assert.equal(state.assistant, true);
  assert.equal(state.investments, false);
  assert.equal("legacy" in state, false);
});

test("o patch só altera o módulo enviado", () => {
  const next = mergeAppModulesPatch({ investments: true }, { assistant: true });
  assert.deepEqual(next, { investments: true, assistant: true });
});

test("o schema recusa módulo desconhecido", () => {
  assert.equal(appModulesPatchSchema.safeParse({ chat: true }).success, false);
  assert.equal(appModulesPatchSchema.safeParse({ investments: false }).success, true);
});
