FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN pnpm --filter @finance/web build

FROM nginx:alpine
# O template vira /etc/nginx/conf.d/default.conf no start do container (envsubst).
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
ENV API_UPSTREAM=api:3333
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
