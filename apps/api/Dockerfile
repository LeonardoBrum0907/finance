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
CMD ["sh", "-c", "pnpm --filter @finance/api db:deploy && node apps/api/dist/server.js"]
