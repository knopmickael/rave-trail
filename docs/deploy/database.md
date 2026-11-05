# Banco de dados, migrations e backup

PostgreSQL 17 roda como um container (`db`) no mesmo box, com dados em um volume
nomeado (`postgres_data`) que sobrevive a reinícios, atualizações da imagem da app
e `docker compose down` (sem `-v`).

## Migrations: como rodam no deploy

Esta é a resposta direta à sua pergunta sobre atualizar o banco pelo CI/CD.

O projeto já tem um mecanismo de migration versionado e **idempotente**:

- As migrations SQL ficam em `backend/migrations/` e são versionadas no git.
- `backend/src/db/migrations.ts` aplica apenas as ainda não registradas, usando:
  - um **advisory lock** (`pg_advisory_xact_lock`) — dois deploys simultâneos não
    corrompem o schema;
  - uma tabela de controle **`schema_migrations`** — cada arquivo roda uma única
    vez;
  - uma **transação** — se um arquivo falha, faz rollback.
- `backend/src/db/migrate.ts` chama `migrate()` e em seguida o `seedDatabase()`
  (seed também idempotente).

### Por que não usamos `tsx` em produção

O `npm run db:migrate` local usa `tsx`, que está em `devDependencies` e **não**
entra na imagem de runtime. Para produção, o build agora gera também
`backend/dist/db/migrate.js` (o `tools/build-api.mjs` recebeu esse segundo
entrypoint). A imagem roda JavaScript puro com Node, sem `tsx`.

### O passo no deploy

Depois de subir a stack, o `deploy-release.sh` chama `run-migrations.sh`, que roda
um container efêmero **da mesma imagem** recém-publicada:

```bash
docker compose -f docker-compose.prod.yaml run --rm --no-deps \
  --entrypoint node app backend/dist/db/migrate.js
```

Como é idempotente, rodar a cada deploy é seguro: migrations já aplicadas são
ignoradas, e apenas os arquivos SQL novos do commit são executados. Para adicionar
uma migration nova, basta criar o próximo arquivo numerado em
`backend/migrations/` (ex.: `038_...sql`) e fazer push — o deploy aplica.

## Backup: por que e como (o `pg_dump`)

Com o Postgres no mesmo box (opção mais barata), **não há backup automático
gerenciado** como no RDS/Managed Database. Compensamos com `pg_dump`:

- **Antes de cada deploy**: o `deploy-release.sh` chama `backup-db.sh` como rede de
  segurança. Se uma migration nova der problema, você tem o estado anterior.
- **Diariamente** (recomendado): agende o `backup-db.sh` via cron.

O `backup-db.sh` executa `pg_dump` dentro do container `db`, comprime com gzip,
grava em `~/rave-trail/backups/` e mantém os **14 mais recentes**.

### Agendar backup diário (cron)

Na instância:

```bash
crontab -e
# Backup todo dia às 03:00
0 3 * * * /home/ubuntu/rave-trail/deploy/scripts/backup-db.sh >> /home/ubuntu/rave-trail/backups/cron.log 2>&1
```

### Restaurar um backup

```bash
cd ~/rave-trail/deploy
set -a; source ./.env.prod; set +a
gunzip -c ~/rave-trail/backups/rave_trail-AAAAMMDD-HHMMSS.sql.gz \
  | docker compose -f docker-compose.prod.yaml exec -T db \
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

O dump usa `--clean --if-exists`, então a restauração recria os objetos sobre o
banco atual.

### Guardar os backups fora do box (recomendado)

Backup no mesmo disco não protege contra perda da instância. Para durabilidade
real, envie os `.sql.gz` para um bucket S3 (barato) com, por exemplo, um passo
extra no cron:

```bash
aws s3 cp ~/rave-trail/backups/ s3://SEU_BUCKET/rave-trail/ --recursive --exclude "*" --include "*.sql.gz"
```

> Dica de custo/durabilidade: um bucket S3 com regra de ciclo de vida movendo
> objetos antigos para Glacier mantém o custo em centavos e protege contra falha
> do disco da instância.

## Migrations destrutivas: cuidado

O gate de CI roda `typecheck` + testes, mas uma migration que apaga ou altera
dados em produção merece atenção redobrada:

- Prefira migrations aditivas (novas colunas/tabelas) e evite `DROP`/`ALTER`
  destrutivo sem um plano de rollback.
- O backup pré-deploy é sua rede de segurança, mas restaurar implica perder os
  dados gravados entre o backup e a falha. Para mudanças sensíveis, rode o deploy
  em horário de baixo movimento.
- Teste migrations novas localmente com `npm run test:db` antes do push.

## Acesso manual ao banco (psql)

```bash
cd ~/rave-trail/deploy
set -a; source ./.env.prod; set +a
docker compose -f docker-compose.prod.yaml exec db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

O Postgres **não** expõe porta para fora do box (sem `ports:` no compose), então só
é acessível de dentro da instância — o que é bom para segurança.
