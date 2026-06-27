import type { Tool } from "ai";

const TOOL_LIMIT_MESSAGE =
  "Limite de consultas atingido nesta resposta. Responda com os dados já obtidos.";

export function wrapToolsWithGuards(
  tools: Record<string, Tool>,
  maxToolCalls: number,
): Record<string, Tool> {
  let toolCallCount = 0;
  const cache = new Map<string, unknown>();
  const wrapped: Record<string, Tool> = {};

  for (const [name, toolDef] of Object.entries(tools)) {
    const originalExecute = toolDef.execute;
    if (!originalExecute) {
      wrapped[name] = toolDef;
      continue;
    }

    wrapped[name] = {
      ...toolDef,
      execute: async (args, options) => {
        const cacheKey = `${name}:${JSON.stringify(args)}`;
        if (cache.has(cacheKey)) {
          return cache.get(cacheKey);
        }

        if (toolCallCount >= maxToolCalls) {
          return { error: TOOL_LIMIT_MESSAGE };
        }

        toolCallCount += 1;
        const result = await originalExecute(args, options);
        cache.set(cacheKey, result);
        return result;
      },
    };
  }

  return wrapped;
}
