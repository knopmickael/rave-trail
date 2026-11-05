#!/usr/bin/env bash
# Provisionamento inicial de uma instancia Lightsail (Ubuntu 22.04/24.04).
# Executar UMA VEZ, por SSH, logo apos criar a instancia.
# Instala Docker + plugin compose e prepara a pasta do deploy.
set -euo pipefail

echo "==> Atualizando o sistema"
sudo apt-get update -y
sudo apt-get upgrade -y

echo "==> Instalando Docker Engine + plugin compose"
# Repositorio oficial do Docker.
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> Permitindo usar docker sem sudo (reconecte o SSH depois)"
sudo usermod -aG docker "$USER"

echo "==> Instalando AWS CLI v2 (para login no ECR)"
sudo apt-get install -y unzip
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip
unzip -o -q /tmp/awscliv2.zip -d /tmp
sudo /tmp/aws/install --update
rm -rf /tmp/aws /tmp/awscliv2.zip

echo "==> Criando a pasta do deploy em ~/rave-trail"
mkdir -p "$HOME/rave-trail/deploy/scripts"
mkdir -p "$HOME/rave-trail/backups"

cat <<'NEXT'

====================================================================
Provisionamento concluido.

PROXIMOS PASSOS (manuais, uma vez):
  1. Saia e reconecte o SSH para o grupo 'docker' valer.
  2. Copie para ~/rave-trail/deploy/ os arquivos:
       - docker-compose.prod.yaml
       - Caddyfile
       - scripts/deploy-release.sh
       - scripts/run-migrations.sh
       - scripts/backup-db.sh
  3. Crie ~/rave-trail/deploy/.env.prod a partir de .env.prod.example
     e preencha a senha do Postgres e o APP_IMAGE.
  4. No painel do registro.br, aponte o registro A de rave-trail.com.br
     para o IP ESTATICO desta instancia.
  5. No console do Lightsail, abra as portas 80 e 443 (TCP) no firewall
     da instancia. A porta 22 (SSH) ja vem aberta.
  6. Configure o GitHub Actions (secrets) e faça um push na branch develop.
====================================================================
NEXT
