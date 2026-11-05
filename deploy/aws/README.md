# Autenticação AWS para o deploy

Dois atores fora da AWS precisam falar com o Amazon ECR. Eles autenticam de
formas diferentes — não confunda:

| Quem | Onde roda | Autentica com | O que faz no ECR |
|---|---|---|---|
| **GitHub Actions** (CI) | servidores do GitHub | **usuário IAM + chave** (push) | `docker push` da imagem nova |
| **Instância Lightsail** (Ubuntu) | o seu box na AWS | **usuário IAM + chave** (ReadOnly) | `docker pull` da imagem |

São **dois usuários IAM distintos**, com permissões diferentes: o do GitHub pode
fazer push; o da instância só faz pull. Mantê-los separados limita o estrago caso
uma das chaves vaze.

> **Por que não OIDC?** O OIDC (Identity Provider + Role, sem chave fixa) é a opção
> mais segura para o GitHub Actions, mas exige acesso a **IAM → Identity
> providers**, que nem toda conta libera. Se a sua conta não tem esse acesso, use
> o caminho por chave abaixo — é o que o workflow (`.github/workflows/deploy.yml`)
> está configurado para usar. A alternativa OIDC fica documentada no fim deste
> arquivo, para quando a conta permitir.

---

## Parte A — GitHub Actions por usuário IAM com chave (push no ECR)

### A1. Criar o usuário

IAM → **Users** → **Create user**:

- Nome: ex.: `github-actions-rave-trail`
- **Não** marque acesso ao console (é um usuário só de API/chave).

### A2. Anexar permissão de push

Anexe a política gerenciada **`AmazonEC2ContainerRegistryPowerUser`** (permite
push e pull no ECR).

### A3. Criar a access key

Abra o usuário → aba **Security credentials** → **Create access key** → caso de uso
**Third-party service** (ou *Application running outside AWS*) → crie. Guarde a
**Access key ID** e a **Secret access key** (a secret só aparece uma vez).

### A4. Colar os secrets no GitHub

Settings → Secrets and variables → Actions → crie:

| Secret | Valor |
|---|---|
| `AWS_ACCESS_KEY_ID` | Access key ID do usuário |
| `AWS_SECRET_ACCESS_KEY` | Secret access key |
| `AWS_REGION` | `us-east-2` |
| `ECR_REPOSITORY` | `rave-trail` |

O workflow usa essas chaves em `aws-actions/configure-aws-credentials` para o login
no ECR e o push da imagem.

> **Boa prática:** rotacione a chave periodicamente (crie uma nova, atualize os
> secrets, apague a antiga). Como é uma chave de longa duração, trate-a como senha.

---

## Parte B — Instância Lightsail (pull no ECR)

A instância precisa de credenciais para `docker pull` da imagem privada. Aqui é um
**usuário IAM com chave** (não OIDC):

1. IAM → **Users** → **Create user** (ex.: `lightsail-ecr-ro`), sem acesso ao
   console.
2. Anexe a política gerenciada **`AmazonEC2ContainerRegistryReadOnly`** (só leitura
   — a instância não precisa de push).
3. Crie uma **access key** para esse usuário e rode na instância:
   ```bash
   aws configure   # Access key, Secret key, região us-east-2, output json
   ```
4. O `deploy-release.sh` faz `aws ecr get-login-password | docker login` a cada
   deploy, então basta o AWS CLI estar autenticado.

> **Segurança:** o arquivo de credenciais (`*credentials*.txt` em `deploy/`) não é
> versionado — ver `.gitignore`. Depois de rodar `aws configure` na instância,
> apague a cópia local; a chave fica em `~/.aws/credentials` na instância. Use
> **ReadOnly** aqui: se a chave vazar, o dano é limitado a leitura do ECR.

---

## Alternativa — GitHub Actions por OIDC (quando a conta permitir)

Mais seguro que a chave fixa da Parte A: o GitHub apresenta um token temporário e
recebe credenciais que expiram em minutos, sem segredo de longa duração no
repositório. **Requer acesso a IAM → Identity providers.** Se você usar este
caminho, troque no `deploy.yml` o passo de `aws-access-key-id`/
`aws-secret-access-key` por `role-to-assume: ${{ secrets.AWS_ROLE_ARN }}` e
devolva `permissions: id-token: write`.

O arquivo `github-oidc-trust-policy.json` (nesta pasta) traz a *trust policy*
pronta. Placeholders:

| Placeholder | Valor |
|---|---|
| `SEU_ID` | número da conta AWS (12 dígitos) |
| `SEU_USUARIO_GITHUB` | dono do repositório no GitHub |
| `rave-trail` | nome do repositório, se for outro |

A condição em `sub` (`repo:.../rave-trail:ref:refs/heads/develop`) garante que só
este repositório, na branch `develop`, assume a role.

Passos:

1. **IAM → Identity providers → Add provider**: OpenID Connect, URL
   `https://token.actions.githubusercontent.com`, *Get thumbprint*, audience
   `sts.amazonaws.com`.
2. **IAM → Roles → Create role → Web identity**: selecione o provider; se
   aparecerem os campos, preencha organization/repository (`rave-trail`)/branch
   (`develop`).
3. Anexe **`AmazonEC2ContainerRegistryPowerUser`** e nomeie a role (ex.:
   `github-actions-rave-trail`).
4. **Trust relationships → Edit trust policy**: cole o JSON com os placeholders
   trocados.
5. Copie o **ARN** da role para o secret `AWS_ROLE_ARN`.
