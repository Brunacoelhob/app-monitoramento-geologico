# Publicar o sistema em um servidor

Guia para colocar o sistema no ar em **uma máquina Linux com Docker** (uma VPS, por exemplo). O `docker-compose.yml` já sobe banco, API e painel; faltam apenas **HTTPS**, **segredos de produção** e **backup**.

> Este guia não foi executado em um provedor específico: ele descreve o que o próprio repositório já faz e o que precisa ser acrescentado na frente. Confira cada passo no seu ambiente.

## 1. Preparar o servidor

- Docker e Docker Compose instalados.
- Um domínio apontando para o servidor (ex.: `geo.exemplo.com`).
- Portas 80 e 443 liberadas. As portas do compose (`8080`, `3000`, banco) ficam publicadas **somente em `127.0.0.1`**: nada é exposto sem passar pelo proxy.

## 2. Configurar os segredos

```bash
git clone https://github.com/brunacoelhoc/app-monitoramento-geologico.git
cd app-monitoramento-geologico
cp .env.example .env
```

No `.env` de produção:

| Variável | O que fazer |
|---|---|
| `DB_PASS` e `DATABASE_URL` | Senha forte e **igual** nos dois. |
| `JWT_SECRET` | Gere um novo (`openssl rand -hex 48`). Nunca reutilize o de desenvolvimento. |
| `JWT_EXPIRA_EM` | `1h` ou menos. |
| `ADMIN_SENHA` · `VISUALIZADOR_SENHA` | Senhas fortes (mínimo 10 caracteres). |
| `CORS_ORIGENS` | `https://geo.exemplo.com`. |
| `ALERTA_WEBHOOK_URL` | Opcional: URL do Slack/Discord/Teams para alertas Alto e Crítico. |

O arquivo `.env` está no `.gitignore`: não o envie ao repositório.

## 3. Subir

```bash
docker compose up -d db-iot
docker compose up -d --build        # o backend aplica as migrations ao subir
# criar as contas iniciais (uma vez), em uma máquina com Node que alcance o banco:
#   cd backend && npm ci && npm run prisma:migrar && npm run criar-usuarios
```

Confira: `curl http://127.0.0.1:3000/api/saude` deve devolver `{"status":"ok","banco":"ok",...}`. O backend tem *healthcheck* e o painel só sobe depois que a API responde.

No servidor, com `NODE_ENV=production`, o Swagger fica desligado (comportamento intencional).

## 4. HTTPS com proxy reverso

O painel escuta em `127.0.0.1:8080` e já repassa `/api` para a API. Basta um proxy na frente com certificado. Exemplo com **Caddy** (certificado automático):

```
geo.exemplo.com {
    reverse_proxy 127.0.0.1:8080
}
```

Com nginx e Certbot a ideia é a mesma: `proxy_pass http://127.0.0.1:8080;` mais o certificado.

## 5. Backup e restauração

Dados persistentes ficam em dois volumes: `iot_pgdata` (banco) e `iot_uploads` (avatares e acervo).

```bash
# backup do banco
docker exec postgres-iot pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > backup-$(date +%F).dump

# restauração (em um banco vazio)
docker exec -i postgres-iot pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists < backup-AAAA-MM-DD.dump

# backup das imagens enviadas
docker run --rm -v app-monitoramento-geologico_iot_uploads:/dados -v "$PWD":/backup alpine tar czf /backup/uploads-$(date +%F).tgz -C /dados .
```

Agende o `pg_dump` (cron) e copie os arquivos para fora do servidor. O nome do volume depende do nome da pasta do projeto: confira com `docker volume ls`.

## 6. Atualizar

```bash
git pull
docker compose up -d --build     # as migrations pendentes são aplicadas ao subir o backend
```

## 7. Monitoramento

- `GET /api/saude` (pública): use em um monitor externo (UptimeRobot, Healthchecks etc.).
- `docker compose logs -f backend`: o USGS fora do ar, falhas de webhook e erros aparecem aqui.
- Estações sem enviar leituras há mais de 15 minutos abrem um alerta de "sem comunicação" dentro do próprio sistema.

## 8. Lista de conferência antes de publicar

- [ ] `JWT_SECRET`, `DB_PASS` e senhas de usuários trocados.
- [ ] HTTPS ativo e `CORS_ORIGENS` com o domínio real.
- [ ] Nenhuma porta do compose exposta fora de `127.0.0.1`.
- [ ] Backup do banco agendado e restauração testada.
- [ ] `docker compose ps` mostrando o backend como *healthy*.
- [ ] Mensagem "Projeto de portfólio, não é alerta oficial" mantida (RN-27).
