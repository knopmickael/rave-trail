#!/usr/bin/env bash
# Aplica migrations + seed usando a MESMA imagem recem-publicada.
# A migration e idempotente (advisory lock + tabela schema_migrations),
# entao e seguro rodar a cada deploy. Executado pelo deploy-release.sh,
# depois que o container 'app' ja esta no ar e o 'db' saudavel.
set -euo pipefail

cd "$HOME/rave-trail/deploy"

# Roda o CLI de migracao dentro de um container efemero da imagem da app,
# na mesma rede do compose, reutilizando as variaveis de ambiente do servico app.
docker compose -f docker-compose.prod.yaml run --rm --no-deps \
  --entrypoint node \
  app backend/dist/migrate.js

echo "==> Migrations e seed aplicados."
