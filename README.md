# Rave Trail

JRPG de navegador com React/TypeScript/Vite, API Fastify e PostgreSQL. O servidor mantém contas, equipes, campanha, missões e resultados oficiais das batalhas.

## Estrutura do projeto

```text
frontend/
  src/                  Interface React, cliente HTTP, áudio e estilos
  public/media/         Fonte única das imagens, ícones, músicas e vídeos do jogo
  index.html            Entrada da SPA
  vite.config.ts        Desenvolvimento e build do frontend
  tsconfig.json         Tipos do navegador
  dist/                 Build gerado do frontend
backend/
  src/                  HTTP, autenticação e repositórios PostgreSQL
  migrations/           Migrações SQL versionadas
  tsconfig.json         Tipos do servidor, sem DOM
  dist/                 API compilada, sem depender dos fontes TypeScript
shared/
  src/contracts.ts      Contratos entre cliente e servidor
  src/content/          Catálogo, encontros e regras de desbloqueio
  src/core/             Motor puro de combate e cálculo das missões
  tsconfig.json         Tipos puros, sem navegador/Node/frameworks
config/                 Configuração compartilhada de TypeScript e testes
tools/                  Build, testes de arquitetura, geração de mídia e automação
docs/                   Arquitetura, produto, decisões e documentação dos assets
todo-list.md            Solicitações atuais do projeto
```

Detalhes das fronteiras e da publicação: [docs/architecture.md](docs/architecture.md).

SEO, páginas públicas e envio do site aos buscadores: [docs/seo.md](docs/seo.md).

`frontend/public/media/` é a única fonte dos arquivos usados pelo jogo. `frontend/dist/media/` é a cópia **gerada** para publicação. Os templates estão em `docs/design/templates/`.

## Executar localmente

Requisitos: Node.js **22.12+**, npm e PostgreSQL 17 (ou Docker Desktop).

Na raiz do projeto:

```powershell
npm install
Copy-Item .env.example .env
npm run db:up
npm run db:migrate
npm run dev
```

Abra **http://127.0.0.1:5173**. A API usa a porta 3001 e o Vite encaminha `/api` a ela. Configure `APP_ORIGIN` com a origem exata usada no navegador. Se já possui PostgreSQL, configure `DATABASE_URL` no `.env` e dispense `db:up`.

O `.env` permanece na raiz; somente o backend o carrega. A configuração é encontrada pelo caminho do módulo, tanto em desenvolvimento quanto no build.

### Comandos

| Comando | Finalidade |
|---|---|
| `npm run dev` | Frontend e API com atualização automática |
| `npm run dev:web` | Somente Vite, usando `frontend/vite.config.ts` |
| `npm run dev:api` | Somente API, usando `backend/tsconfig.json` |
| `npm run db:up` / `npm run db:down` | Iniciar/parar PostgreSQL no Docker, preservando o volume |
| `npm run db:migrate` | Aplicar SQL de `backend/migrations/` e inicializar catálogo |
| `npm run db:seed` | Reexecutar o seed idempotente |
| `npm test` | Testes de interface, HTTP, regras e arquitetura |
| `npm run test:architecture` | Verificar fronteiras e caminhos de mídia |
| `npm run test:db` | Integração em PostgreSQL exclusivo de testes |
| `npm run smoke:production` | Conferir o executável compilado, a SPA e a API usando o banco de testes |
| `npm run typecheck` | Conferir separadamente frontend, backend, shared e ferramentas |
| `npm run build` | Gerar `frontend/dist/` e `backend/dist/` |
| `npm run build:web` / `npm run build:api` | Compilar cada aplicação separadamente |
| `npm start` | Executar a API compilada; em produção serve também a SPA |
| `npm run clean` | Remover somente saídas geradas de build/cobertura |
| `npm run assets:sky` | Regenerar o céu animado; FFmpeg somente na autoria |
| `npm run assets:battles` | Regenerar cenários animados a 30 fps; FFmpeg somente na autoria |
| `npm run assets:mocks` | Gerar arte mockada; Sharp somente na autoria |
| `npm run assets:campaigns` | Gerar imagens dos cards de campanha |

## Funcionalidades atuais

### Conta e perfil

- Cadastro/login por e-mail e senha, com hash `scrypt` e sessões opacas no PostgreSQL.
- Sessão de **uma hora absoluta**, sem renovação por atividade. O cliente solicita novo login no prazo, inclusive em telas ociosas e ao recuperar o foco.
- Cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção. Mutações exigem `Origin` igual a `APP_ORIGIN`.
- O cartão no canto inferior direito do menu abre o perfil. A edição do nome (1–40 caracteres) é persistida por conta.

### Personagens, equipe e Missões

- O catálogo contém 19 unidades; unidades bloqueadas podem ser consultadas, mas não escaladas.
- Três slots de equipe persistentes, com adição, movimento, substituição e remoção.
- **Missões** mantém cartões iguais em **duas linhas** e colunas horizontais. As setas aparecem apenas quando existe conteúdo na respectiva direção. A página não usa rolagem nativa.
- Os requisitos completos ficam **dentro de cada cartão**, com rolagem vertical própria quando necessário.
- Todas as missões são visíveis. As de personagens ainda não derrotados na campanha ficam **inertes, opacas, sobre fundo preto e com cadeado**.
- A API informa `campaignAvailable`; o servidor também impede conceder missões não habilitadas. Somente os adversários dos encontros já vencidos habilitam as missões correspondentes.
- O progresso de metas usa vitórias oficiais rápidas/Multiplayer, considerando a equipe registrada na partida e o modo correto. Conclusões são automáticas e sem notificações de resgate.
- A correção de progresso solicitada para uma conta foi aplicada pela migração 019, com marcos por missão. Partidas e progresso das outras missões não foram apagados; o seed não restaura os contadores zerados.
- As regras de cada unidade estão em `shared/src/content/unlocks.ts`. Premium têm aquisição desabilitada a US$ 9,90.
- **Jung de Grimória II** é uma unidade independente, com o mesmo HP e habilidades do Jung original. Após vencer a batalha 6, passa a integrar o sorteio da Batalha rápida e sua missão é habilitada. Para escalá-lo, vença **25 batalhas rápidas contra Jung II usando Ravi de Berdal base**. O contador é separado do Jung original; as duas versões contam nas metas gerais de Grimorianos.
- As imagens usam o nome real da unidade: `<nome>-face.png` e `<nome>-body.png`, em minúsculas e sem acentos. Os IDs de unidades permanecem estáveis. Detalhes em [docs/assets/characters.md](docs/assets/characters.md).

### Campanha e batalhas

O primeiro capítulo tem sete encontros sequenciais:

| Batalha | Adversários na ordem dos slots |
|---|---|
| 1 | Saqueador da estrada I, Saqueador da estrada II, Saqueadora da estrada |
| 2 | Jung, Exal e Monnica de Grimória |
| 3 | Drak, Curandeiro e Curandeira de Pontes |
| 4 | Trinity, Vlade e Passago de Espinea |
| 5 | Jung, Exal e Monnica de Grimória |
| 6 | Jung de Grimória II e Exal de Grimória |
| 7 | Exal — Verdadeiro poder |

O mapa usa o vídeo fornecido de 8 segundos em loop. O ponto 6 está na fronteira com as trevas. O duelo final exige Ravi de Berdal na equipe e coloca somente Ravi contra Exal; Ravi é substituído por Berserk no início do segundo turno dele, preservando HP proporcional e efeitos. Essa substituição pertence à partida e não concede o desbloqueio permanente.

Batalhas comuns e rápidas usam a clareira animada; a final usa o cenário das trevas. Ambos os vídeos são **1600×900, 30 fps, 12 segundos/360 quadros**, sem áudio. Fundos respeitam movimento reduzido, pausam em abas ocultas e usam imagens estáticas como fallback.

Cada turno tem 45 segundos; a IA espera 7 segundos antes de agir. A energia prevista é recalculada ao montar o combo. Remoções são feitas pelo × central e bloqueadas se deixarem outra ação sem energia. Combos adversários são apresentados da direita para a esquerda. Registro e desistência usam modais.

### Estratégia do BOT

Campanha e Batalha rápida usam o mesmo planejador **hardcoded, determinístico e sem LLM**, em `shared/src/core/battle.ts`. Ele enumera os combos legais do turno, incluindo a ordem dos personagens, habilidades, alvos, retenções intermediárias de energia e a possibilidade de passar ou usar menos ações.

O critério principal é o **dano efetivo total**: HP realmente removido de todos os adversários, após Guarda e limitado ao HP disponível. Nenhuma cura, proteção ou outro suporte pode compensar um combo que cause menos dano. Em empate, considera eliminações e benefícios de suporte/recursos; ao poder encerrar a batalha, evita ações extras desnecessárias.

Cada prefixo é validado pelo mesmo `previewActions` usado pelo jogador. Estados equivalentes são reaproveitados para reduzir o cálculo. Cada turno extra é planejado novamente a partir do estado oficial. Detalhes dos critérios e testes: [docs/bot-strategy.md](docs/bot-strategy.md).

### Batalha rápida e áudio

O modo rápido sorteia adversários no servidor: protagonistas desde o início e inimigos dos encontros já vencidos. Não avança a campanha. O resultado conta para as metas pertinentes.

Configurações controla volume/silêncio global. Há faixas de menu, batalha comum e batalha final; efeitos de clique, mudança de turno e personagem derrotado. `battle-win.wav` e `battle-lose.mp3` tocam uma vez no resultado oficial. Prévia do combo e releitura do histórico não disparam resultados sonoros.

## Testes e publicação

Para PostgreSQL de testes:

```powershell
docker compose exec -T db createdb -U rave_trail rave_trail_test
npm run test:db
```

`TEST_DATABASE_URL` deve usar um banco diferente do desenvolvimento e cujo nome termine em `_test`; a suíte trunca suas tabelas.

Para produzir o build:

```powershell
npm run typecheck
npm test
npm run build
npm run db:migrate
$env:NODE_ENV = "production"
$env:APP_ORIGIN = "https://seu-dominio.example"
npm start
```

A API compilada publica apenas `frontend/dist/`, atrás de HTTPS. O backend permanece autoritativo para equipes, prazos, comandos, resultados, progresso e desbloqueios. Banco e sessão não são armazenados no navegador.

### Deploy na AWS

Publicação em produção na AWS (Lightsail + ECR + GitHub Actions), com HTTPS
automático via Caddy e deploy a cada push na branch `develop`. Guia completo em
[docs/deploy/README.md](docs/deploy/README.md).

Documentação: [arquitetura](docs/architecture.md), [produto](docs/product.md), [histórico de implementação](docs/implementation-tasks.md), [decisões](docs/decisions.md), [vídeos](docs/assets/video.md), [deploy](docs/deploy/README.md).
