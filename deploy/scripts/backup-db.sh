#!/usr/bin/env bash
# Backup do PostgreSQL via pg_dump, executado DENTRO do container db.
# Chamado pelo deploy-release.sh ANTES de cada deploy (rede de seguranca)
# e tambem agendavel por cron para backup diario.
#
# Mantem os ultimos 14 backups comprimidos em ~/rave-trail/backups.
set -euo pipefail

cd "$HOME/rave-trail/deploy"

# Carrega POSTGRES_USER / POSTGRES_DB do .env.prod.
set -a
# shellcheck disable=SC1091
source ./.env.prod
set +a

BACKUP_DIR="$HOME/rave-trail/backups"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/rave_trail-$STAMP.sql.gz"

echo "==> Gerando backup em $OUT"
docker compose -f docker-compose.prod.yaml exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  | gzip > "$OUT"

# Retencao: mantem os 14 mais recentes.
echo "==> Aplicando retencao (ultimos 14)"
ls -1t "$BACKUP_DIR"/rave_trail-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "==> Backup concluido."
echo "    Para restaurar: gunzip -c ARQUIVO.sql.gz | \\"
echo "      docker compose -f docker-compose.prod.yaml exec -T db psql -U \$POSTGRES_USER -d \$POSTGRES_DB"
