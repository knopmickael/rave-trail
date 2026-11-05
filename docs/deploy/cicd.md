# CI/CD com GitHub Actions

O workflow [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml)
publica o jogo a cada push na branch `develop`.

## Gatilho

- `push` na branch **`develop`** (merge, commit direto ou push).
- `workflow_dispatch` (botão *Run workflow* na aba Actions), para deploy manual.

`concurrency` com `cancel-in-progress: false` garante que dois deploys não rodem
ao mesmo tempo — um espera o outro terminar, evitando corrida no banco.

## O que o pipeline faz

```
push develop
   │
   ├─ job validate ─────────────────────────────
   │     npm ci → npm run typecheck → npm test
   │     (falhou? o deploy nem começa)
   │
   └─ job build-and-deploy (needs: validate) ────
         1. configura credenciais AWS (OIDC)
         2. login no ECR
         3. build da imagem Docker (multi-stage)
         4. push no ECR com duas tags:
              develop-<sha7>   (imutável, para rollback)
              latest           (conveniência)
         5. SCP: sincroniza compose, Caddyfile e scripts para a instância
              (o .env.prod nunca é enviado)
         6. SSH no Lightsail → deploy-release.sh
              backup → pull → up → migrations → prune
```

A imagem é identificada por `develop-<sha-curto>`, então cada deploy é
rastreável e o rollback é só reapontar para uma tag anterior
(ver [runbook.md](runbook.md)).

## Secrets necessários

Em **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Descrição |
|---|---|
| `AWS_ACCESS_KEY_ID` | Chave do usuário IAM com permissão de push no ECR |
| `AWS_SECRET_ACCESS_KEY` | Segredo correspondente |
| `AWS_REGION` | `us-east-2` |
| `ECR_REPOSITORY` | `rave-trail` |
| `LIGHTSAIL_HOST` | IP estático da instância |
| `LIGHTSAIL_USER` | `ubuntu` |
| `LIGHTSAIL_SSH_KEY` | Conteúdo da chave privada SSH (`.pem`) com acesso à instância |

### Autenticação AWS por usuário IAM com chave

É o que o workflow usa. O GitHub Actions autentica com a chave de um usuário IAM
que tem permissão de push no ECR. O passo a passo clicável — criar o usuário,
anexar `AmazonEC2ContainerRegistryPowerUser`, gerar a access key e colar os
secrets — está na **Parte A** de
[`deploy/aws/README.md`](../../deploy/aws/README.md).

> São dois usuários IAM distintos: um para o **GitHub Actions** (push, este) e
> outro para a **instância Lightsail** (pull, *ReadOnly*, Parte B do mesmo
> arquivo). Mantê-los separados limita o estrago se uma chave vazar.

> **Alternativa mais segura (OIDC):** evita a chave de longa duração, mas exige
> acesso a *IAM → Identity providers*, que nem toda conta libera. Documentada ao
> final de [`deploy/aws/README.md`](../../deploy/aws/README.md); requer ajustar o
> `deploy.yml` para `role-to-assume` + `permissions: id-token: write`.

### Chave SSH

Use a chave privada que tem acesso à instância Lightsail. No painel do Lightsail
você pode baixar a chave padrão da conta ou cadastrar a sua própria em
*Account → SSH keys*. O conteúdo inteiro do arquivo `.pem` vai no secret
`LIGHTSAIL_SSH_KEY`.

## Validação antes do deploy

O job `validate` roda `npm run typecheck` e `npm test` (interface, HTTP, regras e
arquitetura). Se qualquer um falhar, o deploy não acontece. Os testes de banco
(`npm run test:db`) exigem Postgres e **não** entram nesse gate; rode-os
localmente antes de abrir o PR para `develop`.

## Primeiro deploy

No primeiro push, ainda não existe banco. O `deploy-release.sh` detecta isso,
pula o backup inicial, sobe a stack (incluindo o Postgres), e então roda as
migrations + seed. A partir do segundo deploy, o backup pré-deploy acontece
normalmente.

## Acompanhar

Aba **Actions** do repositório mostra cada execução. O passo de SSH imprime o log
do `deploy-release.sh` (backup, pull, up, migrations), útil para diagnóstico.
