#!/usr/bin/env bash
# Deploy de uma release na instancia Lightsail.
# Chamado pelo GitHub Actions por SSH. Recebe a tag completa da imagem no ECR
# como primeiro argumento (ou via variavel APP_IMAGE no ambiente).
#
# Sequencia:
#   1. login no ECR            (docker consegue puxar a imagem privada)
#   2. backup do banco         (rede de seguranca antes de qualquer mudanca)
#   3. pull da nova imagem
#   4. sobe a stack            (db + app + caddy)
#   5. roda migrations + seed  (idempotente)
#   6. limpeza de imagens antigas
set -euo pipefail

DEPLOY_DIR="$HOME/rave-trail/deploy"
cd "$DEPLOY_DIR"

NEW_IMAGE="${1:-${APP_IMAGE:-}}"
if [[ -z "$NEW_IMAGE" ]]; then
  echo "ERRO: informe a imagem do ECR como argumento ou em APP_IMAGE." >&2
  exit 1
fi

# Regiao e registry derivados da propria tag da imagem:
#   <acct>.dkr.ecr.<regiao>.amazonaws.com/<repo>:<tag>
ECR_REGISTRY="${NEW_IMAGE%%/*}"
AWS_REGION="$(echo "$ECR_REGISTRY" | sed -E 's/.*\.ecr\.([^.]+)\.amazonaws\.com/\1/')"

echo "==> [1/6] Login no ECR ($ECR_REGISTRY, regiao $AWS_REGION)"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

# Atualiza APP_IMAGE no .env.prod para a nova tag (persistente entre reboots).
if grep -q '^APP_IMAGE=' .env.prod; then
  sed -i "s|^APP_IMAGE=.*|APP_IMAGE=$NEW_IMAGE|" .env.prod
else
  echo "APP_IMAGE=$NEW_IMAGE" >> .env.prod
fi

echo "==> [2/6] Backup do banco (pula se o db ainda nao existir)"
if docker compose -f docker-compose.prod.yaml ps db --status running >/dev/null 2>&1 \
   && [ -n "$(docker compose -f docker-compose.prod.yaml ps -q db)" ]; then
  ./scripts/backup-db.sh || echo "AVISO: backup falhou; prosseguindo."
else
  echo "    Primeiro deploy: sem banco para salvar ainda."
fi

echo "==> [3/6] Puxando a nova imagem"
docker compose -f docker-compose.prod.yaml pull app

echo "==> [4/6] Subindo a stack"
docker compose -f docker-compose.prod.yaml up -d

echo "==> [5/6] Aplicando migrations + seed"
./scripts/run-migrations.sh

echo "==> [6/6] Limpando imagens orfas"
docker image prune -f

echo "==> Deploy concluido: $NEW_IMAGE"
