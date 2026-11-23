# GreenCode AV3

AV3 expande a AV2, sem alterar os arquivos dela. Mantem o Fastify, TypeScript, Prisma e PostgreSQL existentes e acrescenta analises historicas, API publica para parceiros e pedidos de relatorios processados em segundo plano.

## Requisitos

- Node.js 20 ou superior e npm.
- PostgreSQL 14 ou superior, com o banco `greencode` criado (ou ajuste `DATABASE_URL`).
- Windows 10 ou superior ou Ubuntu 24.04.03 ou superior.

## Preparar e iniciar

No terminal, entre na pasta `AV3` e instale as dependencias:

```sh
npm install
```

Copie `.env.example` para `.env` (PowerShell: `Copy-Item .env.example .env`; Ubuntu: `cp .env.example .env`) e edite `DATABASE_URL` e `JWT_SECRET`. Use uma chave aleatoria de pelo menos 32 caracteres no segredo JWT. Mantenha `.env` privado.

Aplique as migrations, gere o Prisma Client, compile e inicialize os dados de demonstracao:

```sh
npx prisma migrate deploy
npx prisma generate
npm run build
npx prisma db seed
```

Inicie em modo de desenvolvimento:

```sh
npm run dev
```

Ou compile e inicie em modo normal:

```sh
npm run build
npm start
```

A API escuta na porta configurada em `PORT` (3333 por padrao). A documentacao interativa fica em `http://localhost:3333/docs`; `http://localhost:3333/health` verifica o servidor.

## Criar uma chave de parceiro

1. Em `/docs`, execute `POST /auth/login` com um usuario administrador (o seed AV2 cria `admin@greencode.local`; senha padrao `GreenCode123!`, salvo se `SEED_PASSWORD` foi definido).
2. Use o botao **Authorize** e informe o token JWT.
3. Execute `POST /api/v1/internal/keys`, informando nome do parceiro, permissoes e, opcionalmente, expiracao. A chave completa `gc_...` aparece apenas nessa resposta; copie e guarde-a em local seguro. O banco armazena somente SHA-256.
4. Para chamadas de parceiro, use **Authorize** de novo e cole a chave no esquema `x-api-key`.

Permissoes aceitas: `trace:read`, `lots:read`, `lots:write` e `reports:read`. Rotas publicas: `/api/v1/public`. Rotas administrativas: `/api/v1/internal`, protegidas pelo JWT e papel de administrador.

## Analises e processamento

Os resultados de eficiencia, rentabilidade e vida util sao gravados como novas linhas historicas. A vida util exige cinco pontos por tipo por padrao. O worker consulta `ReportJob` a cada poucos segundos, gera arquivos JSON ou CSV em `reports-output/`, tenta novamente falhas e recupera pedidos que ficaram `PROCESSING` quando o servidor encerrou inesperadamente.

Os horarios podem ser alterados no `.env`: `CRON_EFFICIENCY`, `CRON_PROFITABILITY` (padrao 02:00 diariamente) e `CRON_LIFESPAN` (02:00 de segunda-feira). `API_RATE_LIMIT_MAX` define o limite por chave em `API_RATE_LIMIT_WINDOW`.

O modelo AV2 nao tinha valor de recuperacao, marca nem modelo do equipamento. A migration AV3 adiciona esses campos como opcionais; informe-os ao cadastrar equipamentos para alimentar a analise de rentabilidade. O calculo de eficiencia usa a data de entrada do lote e a movimentacao mais recente de conclusao do equipamento, pois o modelo AV2 nao guarda data de conclusao do lote.

## Compatibilidade

O projeto usa Node, Fastify, Prisma, PostgreSQL e modulos portaveis do npm. Caminhos de arquivos sao montados com `path.join`; a fila e armazenada no PostgreSQL; nao ha Redis, Docker ou dependencias nativas especificas de sistema. O mesmo conjunto de comandos npm funciona em Windows e Ubuntu.
