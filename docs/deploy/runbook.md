# Runbook: operação do dia a dia

Comandos e procedimentos para operar a Rave Trail em produção. Todos rodam na
instância Lightsail, em `~/rave-trail/deploy`, salvo indicação contrária.

## Estado da stack

```bash
cd ~/rave-trail/deploy
docker compose -f docker-compose.prod.yaml ps
```

## Logs

```bash
# App (Fastify)
docker compose -f docker-compose.prod.yaml logs -f app
# Caddy (TLS/proxy)
docker compose -f docker-compose.prod.yaml logs -f caddy
# Postgres
docker compose -f docker-compose.prod.yaml logs -f db
```

## Reiniciar / parar / subir

```bash
# Reiniciar só a app
docker compose -f docker-compose.prod.yaml restart app
# Subir tudo
docker compose -f docker-compose.prod.yaml up -d
# Parar tudo (PRESERVA o volume do banco)
docker compose -f docker-compose.prod.yaml down
```

> Nunca use `down -v` em produção: o `-v` apaga o volume `postgres_data` e com ele
> todas as contas e progresso.

## Deploy manual (sem passar pelo GitHub)

Útil para subir uma imagem específica ou testar:

```bash
cd ~/rave-trail/deploy
./scripts/deploy-release.sh <ACCOUNT_ID>.dkr.ecr.us-east-2.amazonaws.com/rave-trail:develop-abc1234
```

## Rollback para uma release anterior

Cada deploy publica a tag imutável `develop-<sha7>`. Para voltar:

1. Descubra a tag anterior no ECR (console → ECR → repositório `rave-trail` →
   *Images*) ou nos logs do GitHub Actions.
2. Reaponte para ela:

```bash
cd ~/rave-trail/deploy
./scripts/deploy-release.sh <ACCOUNT_ID>.dkr.ecr.us-east-2.amazonaws.com/rave-trail:develop-<sha-anterior>
```

> Atenção: rollback da **imagem** não desfaz migrations já aplicadas. Se o
> problema veio de uma migration destrutiva, restaure o banco do backup
> pré-deploy (ver [database.md](database.md)).

## Backup sob demanda

```bash
cd ~/rave-trail/deploy
./scripts/backup-db.sh
```

## HTTPS não sobe / certificado não emitido

O Caddy só emite o certificado quando o domínio resolve para o IP estático e as
portas 80/443 estão abertas.

1. Confirme o DNS: `nslookup rave-trail.com.br` deve retornar o IP estático.
2. Confirme o firewall do Lightsail (80 e 443 TCP abertas).
3. Veja o log do Caddy: `docker compose -f docker-compose.prod.yaml logs caddy`.
4. Let's Encrypt tem limite de tentativas por hora; se bater no limite durante
   testes, espere antes de tentar de novo.

## App reinicia em loop

Causas comuns, confira o log da `app`:

- `APP_ORIGIN` sem `https://` → o backend recusa iniciar em produção (validação
  em `config.ts`). Corrija no `.env.prod` e rode `up -d`.
- `DATABASE_URL` inválida ou `db` ainda não saudável → a app faz `SELECT 1` no
  boot; o compose já espera o healthcheck do `db`, mas uma senha errada no
  `.env.prod` quebra a conexão.

## Atualizar a imagem base / patch do SO

```bash
# Pacotes do Ubuntu
sudo apt-get update && sudo apt-get upgrade -y
# Imagens base (Postgres/Caddy) — puxa a tag mais recente da linha fixada
docker compose -f docker-compose.prod.yaml pull
docker compose -f docker-compose.prod.yaml up -d
```

## Subir o plano da instância

Se 1 GB de RAM apertar: Lightsail → *Stop* → *Create snapshot* → criar nova
instância a partir do snapshot num plano maior → reanexar o IP estático. O volume
de dados vai junto no snapshot.

## Health check

```bash
curl -i https://rave-trail.com.br/api/health
# 200 {"status":"ok","database":"up"}     app e banco OK
# 503 {"status":"error","database":"down"} processo vivo, banco fora
```

Use essa URL no monitor externo (ver [monitoring.md](monitoring.md)).

## Checklist pós-deploy

- [ ] `https://rave-trail.com.br` abre com cadeado válido.
- [ ] `GET /api/health` responde `200 {"status":"ok","database":"up"}`.
- [ ] Login e cadastro funcionam (cookie `Secure` exige HTTPS).
- [ ] `docker compose ... ps` mostra os três serviços *Up*/*healthy*.
- [ ] Log da `app` sem erros de conexão com o banco.
- [ ] Backup pré-deploy gravado em `~/rave-trail/backups/`.
