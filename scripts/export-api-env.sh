#!/usr/bin/env bash
# Emite `export KEY=...` a partir de apps/api/.env (para `eval`/`source` no shell).
# Uso: eval "$(bash scripts/export-api-env.sh)"
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/apps/api/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  exit 0
fi

python3 - "$ENV_FILE" <<'PY'
import shlex
import sys
from pathlib import Path

path = Path(sys.argv[1])
for line in path.read_text().splitlines():
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
        continue
    key, value = stripped.split("=", 1)
    key = key.strip()
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    print(f"export {key}={shlex.quote(value)}")
PY
