# Deploy da Rave Trail na AWS (Lightsail)

Guia completo de publicação do jogo na AWS com custo mínimo. A arquitetura é um
**monolito**: um único processo Node (Fastify) serve a API **e** a SPA React já
buildada, com PostgreSQL ao lado. CI/CD pelo GitHub Actions a cada push na branch
`develop`.

- Visão geral e custo: este arquivo
- Provisionamento passo a passo da instância: [lightsail-setup.md](lightsail-setup.md)
- Pipeline CI/CD e segredos: [cicd.md](cicd.md)
- Banco de dados, migrations e backup: [database.md](database.md)
- Operação do dia a dia e troubleshooting: [runbook.md](runbook.md)
- Monitoramento e sinais de escala: [monitoring.md](monitoring.md)

## Arquitetura do deploy

```
                        Internet (HTTPS)
                              │
                     rave-trail.com.br
                     (registro.br → A → IP estático)
                              │
            ┌─────────────────────────────────────┐
            │      Instância Lightsail (1 box)     │
            │                                      │
            │   ┌────────┐   :80/:443              │
            │   │ Caddy  │◀── TLS Let's Encrypt     │
            │   └────┬───┘                          │
            │        │ reverse_proxy app:3001       │
            │   ┌────▼────┐      ┌──────────────┐   │
            │   │  app    │─────▶│   db          │   │
            │   │ (Node)  │ 5432 │ Postgres 17   │   │
            │   │ Fastify │      │ volume        │   │
            │   │ + SPA   │      │ postgres_data │   │
            │   └─────────┘      └──────────────┘   │
            │                                      │
            │   backups/  ← pg_dump diário + pré-deploy │
            └─────────────────────────────────────┘
                              ▲
                              │ docker pull (imagem imutável)
                      ┌───────┴────────┐
                      │  Amazon ECR     │
                      └───────▲────────┘
                              │ build + push
                      ┌───────┴────────┐
                      │ GitHub Actions  │  ◀── push na branch develop
                      └────────────────┘
```

Três containers no mesmo box, orquestrados por Docker Compose:

| Serviço | Imagem | Papel |
|---|---|---|
| `caddy` | `caddy:2-alpine` | Publica 80/443, TLS automático, proxy para `app` |
| `app` | imagem própria no ECR | Node/Fastify: API + SPA buildada |
| `db` | `postgres:17-alpine` | Banco; dados em volume nomeado persistente |

## Por que Lightsail (e não App Runner/ECS)

A carga é a mais simples possível: **um** processo Node + **um** Postgres, sem
Redis, filas ou object storage. Sessões ficam no Postgres (cookie opaco), então o
servidor é praticamente stateless. Para essa escala, uma instância Lightsail é o
menor custo com controle total. App Runner + RDS resolveria sem administrar SO,
mas custa 5–10× mais por mês.

## Custo estimado (mensal)

| Item | Custo |
|---|---|
| Instância Lightsail (1 GB RAM / 2 vCPU) | ~US$ 5–7 |
| IP estático Lightsail (anexado à instância) | grátis |
| Amazon ECR (armazenamento da imagem) | centavos |
| Transferência de dados | incluída (1–2 TB no plano) |
| Domínio `rave-trail.com.br` | pago no registro.br (anual, à parte) |
| **Total AWS** | **~US$ 5–7/mês** |

Backup e patching do Postgres são responsabilidade sua — automatizados pelos
scripts em `deploy/scripts/` (`pg_dump` diário + antes de cada deploy).

## Decisões de arquitetura deste deploy

- **Postgres no mesmo box** (não Managed Database): menor custo; backup via
  `pg_dump` agendado. Troca de risco consciente — ver [database.md](database.md).
- **Entrega via ECR + `docker pull`** (não `git pull` na instância): imagem
  imutável, rollback trivial (basta apontar para a tag anterior).
- **Caddy para TLS**: certificado Let's Encrypt automático, sem gerenciar
  renovação. Exige apenas o registro A do domínio apontando para o IP estático.
- **Migrations como passo do deploy**: `backend/dist/migrate.js` (idempotente,
  com advisory lock) roda após subir a stack. Ver [database.md](database.md).

## Pré-requisitos

- Conta AWS com acesso ao Lightsail e ao ECR.
- Domínio `rave-trail.com.br` (registrado no registro.br) com acesso ao painel de DNS.
- Repositório no GitHub com permissão para configurar Secrets e Actions.

## Caminho de publicação (resumo)

1. Criar o repositório no **ECR** e a instância **Lightsail** com IP estático.
2. Rodar `deploy/scripts/provision-lightsail.sh` na instância (uma vez).
3. Copiar `deploy/` para a instância e criar `deploy/.env.prod`.
4. Apontar o registro **A** de `rave-trail.com.br` para o IP estático.
5. Configurar os **Secrets** do GitHub Actions.
6. **Push na branch `develop`** → pipeline builda, publica no ECR e faz o deploy.

Detalhes de cada passo nos arquivos referenciados acima.
