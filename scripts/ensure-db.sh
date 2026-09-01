#!/usr/bin/env bash
# Garante Postgres local para desenvolvimento: Docker (profile with-db) ou cluster nativo.
# Se DATABASE_URL aponta para um host remoto, não tenta subir Postgres nesta VM.
set -euo pipefail

if [[ -n "${DATABASE_URL:-}" ]]; then
  remote_host="$(python3 -c "
import os, urllib.parse
u = urllib.parse.urlparse(os.environ['DATABASE_URL'])
print(u.hostname or '')
")"
  case "$remote_host" in
    ""|localhost|127.0.0.1|db|host.docker.internal)
      ;;
    *)
      echo "DATABASE_URL remoto ($remote_host); Postgres local não necessário."
      exit 0
      ;;
  esac
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if [ -f docker-compose.yml ] || [ -f compose.yml ]; then
    docker compose --profile with-db up -d db
    exit 0
  fi
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Postgres/Docker nao encontrados. Instale Docker ou PostgreSQL 16+." >&2
  exit 1
fi

if command -v pg_isready >/dev/null 2>&1; then
  if ! pg_isready -q; then
    if command -v pg_ctlcluster >/dev/null 2>&1; then
      sudo pg_ctlcluster 16 main start || sudo pg_ctlcluster "$(ls /etc/postgresql | head -1)" main start
    elif command -v service >/dev/null 2>&1; then
      sudo service postgresql start
    fi
  fi
fi

if ! PGPASSWORD=finance psql -h 127.0.0.1 -U finance -d finance -c 'SELECT 1' >/dev/null 2>&1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'finance') THEN
    CREATE ROLE finance LOGIN PASSWORD 'finance' SUPERUSER;
  END IF;
END
$$;
SELECT 'CREATE DATABASE finance OWNER finance'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'finance')\gexec
SQL
fi

echo "Postgres pronto em postgresql://finance:finance@localhost:5432/finance"
