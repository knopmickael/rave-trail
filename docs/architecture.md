# Arquitetura

## Camadas e dependências

```text
frontend/src ───┐
               ├──> shared/src
backend/src ────┘
    │
    └──> PostgreSQL
```

- `frontend/src`: React, CSS, APIs do navegador e comunicação HTTP por `api.ts`.
- `backend/src`: Fastify, autenticação, autorização, validação e repositórios PostgreSQL.
- `shared/src`: contratos serializáveis, catálogo e funções puras. Não importa React, Node, HTTP, SQL ou APIs do navegador.
- `@game/*` identifica módulos de `shared/src` em TypeScript, Vite, Vitest, tsx e no build da API.
- Frontend e backend não importam código um do outro. Ferramentas de autoria podem combinar arte do frontend e conteúdo compartilhado fora do runtime.

Um único `package.json` e lockfile mantêm as versões das ferramentas e dependências; as aplicações possuem entradas, configurações, fontes e saídas próprias. Não é necessário duplicar `node_modules`.

## Código, dados e ferramentas

| Local | Responsabilidade |
|---|---|
| `frontend/src/features/` | Funcionalidades da SPA e testes de interface |
| `frontend/src/styles/` | Tema/base e estilos globais da aplicação |
| `frontend/public/media/` | Única fonte da mídia de runtime |
| `backend/src/auth/` | Criptografia e contratos de autenticação |
| `backend/src/game/` | Contratos dos repositórios de jogo |
| `backend/src/db/` | Adaptadores SQL, seed e executor de migrações |
| `backend/migrations/` | SQL versionado, fora da publicação do frontend |
| `shared/src/content/` | Definições do seed e regras de conteúdo |
| `shared/src/core/` | Motor de combate e cálculo das missões |
| `config/` | Base TypeScript e configurações de testes |
| `tools/assets/` | Ferramentas opcionais para gerar arte/vídeo |
| `tools/automation/` | Automação local e seus logs ignorados |
| `docs/assets/` | Documentação dos arquivos de mídia |
| `docs/design/templates/` | Referências visuais originais |

## Fonte de mídia versus build

Todos os caminhos de runtime começam em `/media/`. `frontend/src/assets.ts` referencia as imagens gerais, músicas e vídeos; o catálogo mantém os caminhos já persistidos de personagens, habilidades e campanhas.

`frontend/public/media/` é a fonte única. `frontend/dist/media/` é sua cópia gerada pelo Vite para publicação, não uma segunda fonte de edição. `frontend/dist/` e `backend/dist/` são ignorados pelo Git e podem ser recriados com `npm run build`. `npm run clean` remove somente saídas geradas, inclusive os antigos diretórios de build da raiz.

Os documentos e templates não são copiados para o diretório público. As ferramentas de geração apontam para a árvore canônica; o jogo usa arquivos prontos e não depende de Sharp/FFmpeg em runtime.

## Desenvolvimento e build

- Vite usa `frontend/` como raiz e encaminha `/api` para a API local.
- `tsx watch` executa `backend/src/index.ts` usando a configuração de tipos do backend.
- `npm run build:web` compila a SPA em `frontend/dist/`.
- `npm run build:api` usa esbuild para gerar `backend/dist/index.js`, incorporando o código compartilhado e mantendo bibliotecas Node como dependências externas. O executável não depende de caminhos para fontes `.ts`.
- `backend/src/paths.ts` centraliza `.env`, frontend publicado e migrações. `src/` e `dist/` têm a mesma profundidade, permitindo usar os mesmos caminhos no desenvolvimento e no executável.
- As migrações usam `backend/migrations/` e seus nomes originais. Mover os arquivos não reexecuta migrações já registradas no banco.
- O backend em produção serve somente `frontend/dist/`. `.env`, fontes da API e SQL não são publicados como arquivos estáticos.

## Verificação de arquitetura

`npm run test:architecture` analisa os imports estáticos/dinâmicos usando a API do TypeScript e verifica:

1. Ausência de imports entre frontend e backend.
2. Dependências puras de `shared`, sem frameworks ou I/O.
3. Ausência de bibliotecas do servidor no frontend e de React/Vite no backend.
4. Existência dos caminhos de mídia em uma única árvore pública.
5. Separação de fontes, migrações, templates, ferramentas e saídas geradas.

`npm run typecheck` também verifica cada camada separadamente: shared sem tipos de Node/DOM e backend sem DOM. Testes de regras/HTTP/UI e integração com PostgreSQL complementam essas verificações.

## Missões e persistência

Todas as missões retornam da API com `campaignAvailable`. O campo é calculado a partir dos adversários dos encontros que constam em `completedEncounters`, sem aceitar decisões de disponibilidade do cliente. Cartões não habilitados ficam inertes, escurecidos sobre preto e com cadeado; seus contadores retornam zero e não concedem unidades.

Os cartões mantêm duas linhas e tamanho uniforme. A navegação horizontal usa botões condicionais; cada lista de requisitos tem sua própria rolagem vertical.

Marcos em `missionProgressResets` permitem zerar missões específicas sem apagar partidas. As vitórias posteriores ao marco voltam a contar quando a missão está habilitada. A migração 019 contém a correção pontual solicitada e não se repete ao executar o seed.
