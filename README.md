# Finanças — Controle Financeiro com Open Finance e IA

App pessoal full-stack em TypeScript para acompanhar suas finanças via Open Finance
(usando a [Pluggy](https://pluggy.ai)), com um assistente de IA que tem contexto das
suas contas e suporte a múltiplas pessoas por usuário (ex.: você + cônjuge).

## Funcionalidades

- Registro e login (e-mail/senha, sessão via cookie httpOnly).
- Cadastro de várias pessoas por usuário.
- Conexão de contas bancárias via Open Finance (widget da Pluggy).
- Painel com saldo consolidado, saldo por pessoa, contas e extrato recente.
- Chat com IA (provider configurável: OpenAI, Anthropic ou Google) usando seus dados como contexto.

## Stack

- **Monorepo**: pnpm workspaces (`apps/web`, `apps/api`, `packages/shared`).
- **Frontend**: React + Vite + TypeScript + Tailwind + React Router + TanStack Query.
- **Backend**: Fastify + Prisma + PostgreSQL.
- **Open Finance**: `pluggy-sdk` (backend) + `react-pluggy-connect` (frontend).
- **IA**: Vercel AI SDK (`ai`) com providers `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`.

## Pré-requisitos

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Docker (para o PostgreSQL)
- Credenciais da Pluggy (crie uma conta em https://dashboard.pluggy.ai e pegue `CLIENT_ID` / `CLIENT_SECRET`)
- Uma chave de API de IA (OpenAI, Anthropic ou Google)

## Setup local

```bash
# 1. Instalar dependências
pnpm install

# 2. Subir o PostgreSQL
pnpm db:up

# 3. Configurar variáveis de ambiente da API
cp apps/api/.env.example apps/api/.env
#   edite apps/api/.env e preencha JWT_SECRET, PLUGGY_* e a chave de IA

# 4. Gerar o Prisma Client e aplicar as migrações
pnpm db:generate
pnpm db:migrate

# 5. Rodar API + Web em paralelo
pnpm dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3333

O Vite faz proxy de `/api` para a API, então o cookie de sessão funciona na mesma origem.

## Variáveis de ambiente (API)

Veja `apps/api/.env.example`. Principais:

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | Conexão Postgres |
| `JWT_SECRET` | Segredo para assinar a sessão (use um valor aleatório longo) |
| `WEB_ORIGIN` | Origem do frontend (CORS) |
| `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` | Credenciais da Pluggy |
| `AI_PROVIDER` | `openai`, `anthropic` ou `google` |
| `AI_MODEL` | Opcional; usa um padrão por provider se vazio |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | Chave do provider escolhido |

## Como conectar uma conta

1. Cadastre uma pessoa na aba **Pessoas**.
2. No **Painel**, escolha a pessoa e clique em **Conectar conta bancária**.
3. O widget da Pluggy abre; selecione o banco e dê o consentimento.
   - O widget está com `includeSandbox`, então em ambiente de testes você pode usar
     os conectores de sandbox da Pluggy (ex.: "Pluggy Bank") para simular dados.
4. Ao finalizar, a conta é sincronizada (saldos e extrato dos últimos 365 dias).

## Sincronização

- Sync inicial acontece ao conectar.
- Re-sincronize manualmente em **Pessoas → Sincronizar**.
- O endpoint `POST /api/pluggy/webhook` recebe eventos da Pluggy e re-sincroniza.
  Em produção, configure essa URL no dashboard da Pluggy.

## Deploy em VPS (Docker Compose)

Há dois caminhos. Nos dois, o nginx do `web` serve o frontend e faz proxy de `/api`
para a API (mesma origem → cookie de sessão funciona).

### 1) Postgres na própria VPS (recomendado se você já sobe o banco à parte)

```bash
git clone https://github.com/LeonardoBrum0907/finance.git
cd finance
cp .env.deploy.example .env
# edite .env: JWT_SECRET, DATABASE_URL, WEB_ORIGIN, Pluggy, chaves de IA

# Postgres acessível a partir dos containers (ex.: na VPS em 5432):
# DATABASE_URL=postgresql://finance:SENHA@host.docker.internal:5432/finance?schema=public

docker compose --profile full up -d --build
```

Garanta que o Postgres aceite conexões da bridge do Docker (e que o user/db existam).

### 2) Postgres + app tudo no Compose

```bash
cp .env.deploy.example .env
# em .env use DATABASE_URL com host `db` e a mesma senha do POSTGRES_PASSWORD
docker compose --profile with-db --profile full up -d --build
```

- Web: porta `8080` (ou `WEB_PORT`)
- A API aplica migrações no start (`prisma migrate deploy`)
- Volume `finance-db-data` persiste o banco na opção 2

> Cookies: em `NODE_ENV=production` o cookie usa `secure: true` → precisa de **HTTPS**
> (Caddy/nginx/Cloudflare na frente). Para teste rápido em HTTP puro:
> `NODE_ENV=development` no `.env`.

Webhook Pluggy em produção: `https://SEU_DOMINIO/api/pluggy/webhook`.

## Estrutura

```
apps/
  api/    Fastify + Prisma + Pluggy + IA
  web/    React + Vite + Tailwind
packages/
  shared/ Tipos e schemas (zod) compartilhados
docker-compose.yml
```

## Scripts úteis (raiz)

| Comando | Ação |
| --- | --- |
| `pnpm dev` | Roda API e Web em paralelo |
| `pnpm dev:api` / `pnpm dev:web` | Roda só um deles |
| `pnpm db:up` / `pnpm db:down` | Sobe/derruba o Postgres |
| `pnpm db:migrate` | Cria/aplica migração de desenvolvimento |
| `pnpm db:studio` | Abre o Prisma Studio |
| `pnpm build` | Builda todos os pacotes |
