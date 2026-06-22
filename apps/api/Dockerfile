# Build e runtime da API (monorepo pnpm)
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# Dependencias do workspace necessarias para a API
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile=false

# Codigo
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @finance/api db:generate
RUN pnpm --filter @finance/api build

EXPOSE 3333
# Aplica migracoes e sobe a API
CMD ["sh", "-c", "pnpm --filter @finance/api db:deploy && node apps/api/dist/server.js"]
