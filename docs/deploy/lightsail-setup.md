# Provisionamento do Lightsail e do ECR

Passo a passo único para preparar a infraestrutura. Depois disso, publicações são
automáticas via `git push` na branch `develop`.

## 1. Criar o repositório no Amazon ECR

Console AWS → **ECR** → *Create repository*:

- Visibilidade: **Private**
- Nome: `rave-trail`
- Região: **`us-east-2`** (Ohio — barata e coberta pelo free tier)

Anote o URI do repositório, no formato:

```
<ACCOUNT_ID>.dkr.ecr.us-east-2.amazonaws.com/rave-trail
```

## 2. Criar a instância Lightsail

Console AWS → **Lightsail** → *Create instance*:

- Região: **Ohio (us-east-2)** — a mesma do ECR
- Plataforma: **Linux/Unix**
- Blueprint: **OS Only → Ubuntu 24.04 LTS**
- Plano: **US$ 5/mês** (1 GB RAM, 2 vCPU, 40 GB SSD) — suficiente para começar;
  é possível subir de plano depois sem recriar.
- Nome: `rave-trail`

### IP estático

Aba **Networking** da instância → *Create static IP* → anexar à instância
`rave-trail`. **Use sempre o IP estático** (o IP público padrão muda se a
instância for parada).

### Firewall da instância

Aba **Networking** → *IPv4 Firewall*, garanta as regras:

| Aplicação | Protocolo | Porta |
|---|---|---|
| SSH | TCP | 22 |
| HTTP | TCP | 80 |
| HTTPS | TCP | 443 |

A porta 80 é necessária para o desafio HTTP do Let's Encrypt (Caddy).

## 3. Provisionar a instância (uma vez)

Baixe a chave SSH padrão em Lightsail → *Account* → *SSH keys*, ou use a aba
*Connect*. Conecte por SSH e rode o script de provisionamento:

```bash
# Na sua máquina: copie o script para a instância
scp -i rave-trail.pem deploy/scripts/provision-lightsail.sh ubuntu@<IP_ESTATICO>:~

# Na instância
ssh -i rave-trail.pem ubuntu@<IP_ESTATICO>
chmod +x provision-lightsail.sh
./provision-lightsail.sh
# saia e reconecte para o grupo docker valer
exit
```

O script instala Docker + compose + AWS CLI e cria `~/rave-trail/deploy/`.

## 4. Enviar os arquivos de deploy para a instância

Da raiz do projeto, na sua máquina:

```bash
scp -i rave-trail.pem -r deploy/docker-compose.prod.yaml deploy/Caddyfile deploy/scripts \
  ubuntu@<IP_ESTATICO>:~/rave-trail/deploy/
```

Na instância, torne os scripts executáveis:

```bash
ssh -i rave-trail.pem ubuntu@<IP_ESTATICO>
cd ~/rave-trail/deploy
chmod +x scripts/*.sh
```

## 5. Criar o `.env.prod` na instância

Ainda na instância, crie `~/rave-trail/deploy/.env.prod` com base no exemplo
versionado `deploy/.env.prod.example`:

```bash
cat > ~/rave-trail/deploy/.env.prod <<'EOF'
APP_DOMAIN=rave-trail.com.br
APP_ORIGIN=https://rave-trail.com.br
POSTGRES_USER=rave_trail
POSTGRES_PASSWORD=<SENHA_FORTE_AQUI>
POSTGRES_DB=rave_trail
APP_IMAGE=<ACCOUNT_ID>.dkr.ecr.us-east-2.amazonaws.com/rave-trail:latest
EOF
chmod 600 ~/rave-trail/deploy/.env.prod
```

> `.env.prod` contém segredos e **não** é versionado (coberto pelo `.gitignore`).
> O `APP_IMAGE` é reescrito automaticamente a cada deploy pelo CI/CD.

## 6. Permitir que a instância puxe do ECR

A instância precisa de credenciais AWS para `docker pull` da imagem privada.
Opção mais simples: criar um usuário/role IAM com a política gerenciada
`AmazonEC2ContainerRegistryReadOnly` e configurar na instância:

```bash
aws configure   # Access key, Secret key, região us-east-2
```

O `deploy-release.sh` faz `aws ecr get-login-password | docker login` a cada
deploy, então basta o AWS CLI estar autenticado na instância.

## 7. Apontar o DNS

> **NÃO use a tela "Alterar servidores DNS" (nameservers).** Ali só entram *nomes*
> de servidores (ex.: `ns1.exemplo.com`), nunca um IP — colar o IP do Lightsail
> retorna o erro "Endereços IP não podem ser usados como servidores DNS". Isso é
> para delegar o DNS a outro provedor (Route 53, Cloudflare), o que **não** é o
> nosso caso. Deixe os nameservers no padrão do registro.br.

O que você quer é a tela **"DNS" / "Editar zona DNS"** (às vezes chamada
*Configurar endereçamento*), onde se criam os **registros** da zona. Se o painel
não mostrar a edição da zona, procure o botão "Usar os servidores DNS do
registro.br" / "Configurar endereçamento" e ative — a aba de edição aparece.

No painel do **registro.br**, em *Editar zona DNS* de `rave-trail.com.br`, crie:

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` (ou deixe em branco = o domínio raiz) | `<IP_ESTATICO>` |
| A | `www` *(opcional)* | `<IP_ESTATICO>` |

Aguarde a propagação (minutos a algumas horas). Confira com:

```bash
nslookup rave-trail.com.br
```

Quando o domínio resolver para o IP estático, o Caddy emite o certificado TLS
automaticamente no primeiro acesso.

## Pronto

A infraestrutura está provisionada. Daqui em diante, publicar é só dar push na
branch `develop` — ver [cicd.md](cicd.md).
