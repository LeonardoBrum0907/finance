# Build e runtime da API (monorepo pnpm)
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @finance/api db:generate
RUN pnpm --filter @finance/api build

EXPOSE 3333
# O @finance/shared é exportado como TypeScript (src/index.ts, com imports sem
# extensão). O node puro não resolve esses imports e a API caía com
# ERR_MODULE_NOT_FOUND ao subir; o loader do tsx resolve. exec deixa o node
# como PID 1 para receber o SIGTERM do Docker.
WORKDIR /app/apps/api
CMD ["sh", "-c", "pnpm db:deploy && exec node --import tsx dist/server.js"]
