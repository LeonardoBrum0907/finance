#!/usr/bin/env bash
# Copia secrets injetadas pelo Cursor Cloud (e variáveis já presentes no ambiente)
# para apps/api/.env, para que dotenv e getAiEnv(override) usem os mesmos valores em cada boot.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/apps/api/.env"
EXAMPLE="$ROOT/apps/api/.env.example"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE" "$ENV_FILE"
fi

# Lista de chaves que o Cloud pode injetar (CLOUD_AGENT_ALL_SECRET_NAMES ou fallback).
IFS=',' read -r -a KEYS <<< "${CLOUD_AGENT_ALL_SECRET_NAMES:-}"

if [[ ${#KEYS[@]} -eq 0 ]]; then
  KEYS=(
    DATABASE_URL JWT_SECRET PORT WEB_ORIGIN
    PLUGGY_CLIENT_ID PLUGGY_CLIENT_SECRET
    AI_PROVIDER AI_MODEL AI_FALLBACK_PROVIDER AI_FALLBACK_MODEL
    AI_MONTHLY_TOKEN_BUDGET AI_MAX_STEPS AI_MAX_TOOL_CALLS
    AI_REQUEST_TIMEOUT_MS AI_REGENERATE_COOLDOWN_MS
    AI_PROMPT_CACHE_ENABLED AI_PROMPT_CACHE_KEY_PREFIX
    OPENAI_API_KEY ANTHROPIC_API_KEY GOOGLE_GENERATIVE_AI_API_KEY
  )
fi

python3 - "$ENV_FILE" "${KEYS[@]}" <<'PY'
import os, sys
from pathlib import Path

env_path = Path(sys.argv[1])
keys = sys.argv[2:]

def quote(v: str) -> str:
    if any(c in v for c in ' \t#"\'\\'):
        return '"' + v.replace('\\', '\\\\').replace('"', '\\"') + '"'
    return v

text = env_path.read_text() if env_path.exists() else ""
lines = text.splitlines()
existing_order: list[tuple[str, str | None]] = []
seen: set[str] = set()

for line in lines:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
        existing_order.append(("raw", line))
        continue
    k, v = stripped.split("=", 1)
    k = k.strip()
    seen.add(k)
    if k in keys and os.environ.get(k):
        existing_order.append(("kv", k, quote(os.environ[k])))
    else:
        existing_order.append(("kv", k, v))

for k in keys:
    if k not in seen and os.environ.get(k):
        existing_order.append(("kv", k, quote(os.environ[k])))

out: list[str] = []
for item in existing_order:
    if item[0] == "raw":
        out.append(item[1])
    else:
        out.append(f"{item[1]}={item[2]}")

env_path.write_text("\n".join(out) + "\n")

synced = [k for k in keys if os.environ.get(k)]
if synced:
    print(f"sync-api-env: {len(synced)} variável(s) do ambiente → apps/api/.env")
else:
    print("sync-api-env: nenhuma variável de ambiente para sincronizar")
PY
