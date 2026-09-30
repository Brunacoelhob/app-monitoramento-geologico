# Monitoramento IoT: PostgreSQL + Backend NestJS + Frontend Streamlit

Sistema que armazena leituras de sensores de temperatura e as exibe em um painel. Toda a regra de negócio, autenticação, autorização e validação ficam no **backend**; o **frontend é só um visualizador** e nunca acessa o banco.

Dataset: [Temperature Readings: IoT Devices](https://www.kaggle.com/datasets/atulanandjha/temperature-readings-iot-devices) (Kaggle). Confira a licença antes de redistribuir.

## Arquitetura

```
Navegador ──► Frontend (Streamlit :8501) ──► Backend (NestJS :3000) ──► PostgreSQL (:5432)
                    só exibe                 login, papéis, validação      só o backend acessa
                                             Prisma ORM
```

O Docker usa duas redes: `rede_banco` (banco + backend) e `rede_app` (backend + frontend). O frontend não enxerga o banco.

```
.
├── backend/               API NestJS + Prisma
│   ├── prisma/            schema.prisma e migrations
│   ├── scripts/           importar-csv.ts e criar-usuarios.ts
│   └── src/
│       ├── auth/          login (JWT), guards de autenticação e papéis
│       ├── leituras/      consultas, cadastro e tratamento dos dados
│       ├── prisma/        acesso ao banco
│       └── config/        validação das variáveis de ambiente
├── frontend/              painel Streamlit (somente leitura, via API)
├── data/                  CSV de origem
├── docker-compose.yml
└── .env.example
```

## Segurança (aplicada no backend)

- **Autenticação:** JWT (expira em 1h por padrão). Todas as rotas exigem token, exceto `POST /api/auth/login`.
- **Autorização:** papéis `ADMIN` e `VISUALIZADOR`. Só o `ADMIN` cadastra leituras.
- **Sem cadastro público:** usuários só são criados pelo script `criar-usuarios`.
- **Senhas** guardadas com bcrypt; login com mensagem única para email/senha errados.
- **Limite de requisições:** 100/min por IP, e 5/min no login (proteção contra força bruta).
- **Validação:** `ValidationPipe` rejeita campos desconhecidos, tipos errados e paginação acima de 100. Consultas SQL são parametrizadas (Prisma).
- **Consistência:** chave primária, `id` único (conflito devolve 409), faixa de temperatura de -50 a 150 °C, enums para o sentido.
- **Cabeçalhos** de segurança com Helmet e CORS restrito a `CORS_ORIGENS`.
- **Containers** do backend e frontend sem root; portas publicadas só em `127.0.0.1`.
- **Segredos** só no `.env`, que está no `.gitignore`.

## Pré-requisitos

Docker e Docker Compose. Para rodar fora do Docker: Node 22+ e Python 3.10+.

## Como executar

1. **Configure o ambiente**

   ```bash
   cp .env.example .env
   ```

   No `.env`, defina `DB_PASS` (e a mesma senha em `DATABASE_URL`), gere o `JWT_SECRET` conforme o comentário do arquivo e escolha as senhas de `ADMIN_SENHA` e `VISUALIZADOR_SENHA`. Se a porta 5432 estiver ocupada na sua máquina, mude `DB_PORT` e a porta em `DATABASE_URL`.

2. **Suba o banco e prepare os dados** (uma única vez)

   ```bash
   docker compose up -d db-iot
   cd backend
   npm install
   npm run prisma:migrar      # cria as tabelas
   npm run criar-usuarios     # cria admin e visualizador
   npm run importar-csv       # carrega data/temperature_readings.csv
   cd ..
   ```

   `importar-csv` pode rodar de novo sem duplicar (registros com `id` existente são ignorados). Aceita outro arquivo: `npm run importar-csv -- caminho.csv`.

3. **Suba backend e frontend**

   ```bash
   docker compose up -d --build
   ```

   Painel em http://localhost:8501. Entre com o email e a senha do `VISUALIZADOR_*` ou `ADMIN_*` que você definiu no `.env`.

### Desenvolvimento sem Docker (backend e frontend)

```bash
docker compose up -d db-iot
cd backend && npm run start:dev                  # API em :3000
cd frontend && pip install -r requirements.txt && streamlit run app.py
```

## API

Prefixo `/api`. Envie `Authorization: Bearer <token>`.

| Método | Rota | Papel | Descrição |
|---|---|---|---|
| POST | `/auth/login` | público | `{ email, senha }` → `{ token, usuario }` |
| GET | `/auth/eu` | logado | Dados do usuário do token |
| GET | `/leituras` | logado | Lista paginada. Filtros: `inicio`, `fim`, `sentido`, `pagina`, `limite` (máx. 100) |
| GET | `/leituras/periodo` | logado | Menor e maior data disponíveis |
| GET | `/leituras/totais` | logado | Total, temperatura média e salas |
| GET | `/leituras/serie-horaria` | logado | Média por hora e sentido |
| POST | `/leituras` | ADMIN | Cadastra uma leitura |

`sentido` aceita `INTERNO` ou `EXTERNO`; `inicio` e `fim` no formato `aaaa-mm-dd`.

## Banco de dados (Prisma)

- `leituras_temperatura`: `id` (PK), `sala`, `data_leitura`, `temperatura` (decimal 5,1), `sentido`, com índice por data.
- `usuarios`: `email` (único), `senha_hash`, `papel`.
- Mudou o `schema.prisma`? Rode `npm run prisma:migrar:dev` para gerar a migration.

## Decisões de dados

- Colunas do CSV renomeadas: `room_id/id` → `sala`, `noted_date` → `data_leitura`, `temp` → `temperatura`, `out/in` → `sentido`.
- Só o `id` repetido é descartado. O CSV tem cerca de 60 mil leituras iguais com ids diferentes, mantidas por poderem ser legítimas. Para removê-las, altere `removerIdsRepetidos` em `backend/src/leituras/tratamento.ts`.
- Uma linha inválida no CSV aborta a importação inteira; nada é carregado pela metade.
- Datas no formato `dd-mm-aaaa hh:mm`, guardadas como UTC.

## Testes

```bash
cd backend
npm test
npx tsc --noEmit
```

O GitHub Actions (`.github/workflows/ci.yml`) roda checagem de tipos, testes e build do backend.

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| `Variável de ambiente ... não definida` | O `.env` não existe ou está incompleto |
| `port is already allocated` / `bind ... proibida` | Porta em uso. Mude `DB_PORT` no `.env` e em `DATABASE_URL` |
| `password authentication failed` | O volume guarda a senha antiga. Para recomeçar do zero: `docker compose down -v` (apaga os dados) |
| Login retorna 429 | Limite de 5 tentativas por minuto. Aguarde |
| Painel diz "Nenhum dado encontrado" | Falta rodar `npm run importar-csv` |

## Autora

Bruna Coelho

## Frontend Angular (`frontend-angular/`)

Substitui o dashboard Streamlit. Angular 22 + Angular Material + ECharts, consumindo a API do backend.

**Desenvolvimento** (com o banco e o backend no ar):

```bash
cd frontend-angular
npm install
npm start            # http://localhost:4200 (use --port 4300 se a 4200 estiver ocupada)
```

O `proxy.conf.json` encaminha `/api` para `http://127.0.0.1:3000`, então não há CORS no desenvolvimento.

**Docker** (`docker compose up -d --build`): o nginx serve o Angular em http://localhost:8080 e repassa `/api` para o backend.

| Pasta | Conteúdo |
|---|---|
| `src/app/core/` | Autenticação (serviço, interceptor JWT, guards), serviços da API, filtros e tema |
| `src/app/layout/` | Estrutura com menu lateral e barra superior |
| `src/app/paginas/` | Login, Painel (KPIs e gráficos) e Leituras (tabela paginada) |
| `src/app/compartilhado/` | Barra de filtros usada nas duas páginas |

### Funcionalidades do frontend

- **Painel:** hero explicativo com botão de relatório, filtros só por calendário (padrão: últimos 30 dias até hoje, sem limite de intervalo), 4 cartões animados com mini-gráfico e **modal informativo ao clicar em cada cartão**, gráficos ECharts.
- **Menu lateral recolhível** (o estado fica salvo no navegador).
- **Relatórios** em **PDF** (resumo + gráfico), **Excel** (abas Resumo, Por dia/mês e Leituras) e **CSV** (dados brutos), sempre respeitando o período e o sentido filtrados.
- **Perfil:** avatar, dados pessoais e endereço (CPF, celular e CEP com máscara e validação; endereço preenchido pelo **ViaCEP**), troca de senha e **acervo de imagens** com upload, ampliação, download e exclusão.

### Endpoints adicionados (todos exigem JWT)

| Rota | Função |
|---|---|
| `GET /api/leituras/relatorio?formato=pdf\|xlsx\|csv&inicio&fim&sentido` | Baixa o relatório (máx. 500 mil linhas para Excel/CSV) |
| `GET /api/perfil` · `PUT /api/perfil` | Lê e atualiza o perfil do usuário logado |
| `PUT /api/perfil/senha` | Troca a senha (5 tentativas/min; senha atual errada devolve 422) |
| `GET/PUT/DELETE /api/perfil/avatar` | Foto de perfil (até 2 MB) |
| `GET/POST /api/perfil/acervo` · `GET /api/perfil/acervo/:id/arquivo[?baixar=1]` · `DELETE /api/perfil/acervo/:id` | Acervo (até 50 imagens de 5 MB, 10 por envio) |

As imagens ficam em disco na pasta definida por `UPLOADS_DIR` (volume `iot_uploads` no Docker), com nome aleatório. O tipo é conferido pelos primeiros bytes do arquivo (JPG, PNG, GIF ou WEBP; SVG é recusado) e cada usuário só acessa as próprias imagens.

> **Migrations:** a migração inicial foi editada depois de aplicada, então `prisma migrate dev` pede para apagar o banco. Para aplicar migrações novas sem perder dados, gere o SQL com `prisma migrate diff` e aplique com `npm run prisma:migrar` (foi assim que `perfil_e_acervo` foi criada).


## Módulo de sismos: backend (Japão)

Regras em [docs/regras-de-negocio-sismos.md](docs/regras-de-negocio-sismos.md). O backend cobre estações e sensores, ingestão por chave, sismos do USGS, alertas, simulador e relatórios.

**Como rodar:**

```bash
cd backend
npm run prisma:migrar      # cria as tabelas (e vincula as leituras antigas à estação "legado")
npm run sismos:semear      # cria 4 estações simuladas, gera leituras e importa os sismos do USGS
npm run start:dev          # o agendador importa o USGS a cada 10 min e roda o simulador a cada minuto
```

`SISMOS_AGENDADOR=false` desliga as tarefas em segundo plano. Os limites das regras (distância, tempos, magnitude mínima) estão no `.env.example`.

**Verificação das regras** (cria dados de teste `TESTE-*` no banco e confere 15 regras de alerta):

```bash
npm run sismos:testar-regras            # roda e confere
npm run sismos:testar-regras -- limpar  # remove os dados de teste
```

| Rota | Quem | Função |
|---|---|---|
| `GET /api/estacoes` · `/:id` · `/:id/series?horas=` | todos | Estações, status online e séries de sismógrafo, GPS e temperatura |
| `POST /api/estacoes` · `PUT /:id` · `PUT /:id/situacao` · `POST /:id/chave` · `POST /:id/sensores` | admin | Gerencia estações; a chave de API aparece uma única vez |
| `POST /api/ingestao/leituras` | chave da estação (`x-chave-estacao`) | Recebe leituras (até 500 por chamada) |
| `GET /api/eventos` · `/totais` · `/serie-diaria` · `/mapa` · `/periodo` | todos | Sismos com filtros (período, magnitude, nível, origem, estação) |
| `GET /api/eventos/relatorio?formato=pdf\|xlsx\|csv` | todos | Relatório de eventos e alertas |
| `POST /api/eventos/sincronizar` | admin | Força a sincronização com o USGS |
| `GET /api/alertas` · `/:id` | todos | Alertas, com réplicas, histórico e estações próximas |
| `PUT /api/alertas/:id/reconhecer` · `/encerrar` | admin | Muda o estado do alerta |
