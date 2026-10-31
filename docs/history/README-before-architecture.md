# Rave Trail

Registro histórico anterior à reorganização. Para estrutura e comandos vigentes, consulte o [README atual](../../README.md) e a [arquitetura](../architecture.md).

Base full-stack do JRPG de navegador: React + TypeScript + Vite, API Fastify e PostgreSQL.

## Estado atual

Implementados: tela inicial com os assets existentes, cadastro, login, restauração de sessão, logout, leitura autenticada do progresso, migrações do banco, motor de combate, mapa da campanha e batalhas autoritativas. Cadastro cria conta, progresso e sessão em uma única transação.

Após entrar, o menu principal permite abrir a **Lista de personagens**. Todo o catálogo do banco aparece no alto à esquerda, em cinco miniaturas por linha com gap compacto. Imagem e nome do personagem selecionado ficam centralizados na tela; habilidades e descrição ficam ancoradas à direita, preenchendo a altura disponível abaixo do cabeçalho. A equipe continua no canto inferior esquerdo. Bloqueados podem ser consultados, com imagem esmaecida/cadeado e adição à equipe desabilitada. O corpo inteiro é PNG transparente, sem cartão atrás; os painéis de dados são opacos. Em telas menores, os blocos se reorganizam sem rolagem horizontal.

O menu fica fixo no canto superior esquerdo, com o logo acima dos itens e sem painel externo. Os botões exibem somente seus nomes, sem setas ou textos auxiliares. No canto inferior direito há um cartão branco com foto provisória, nome e e-mail da conta. Ao clicar, abre o modal de perfil com edição do **Nome** (1–40 caracteres, salvo no PostgreSQL) e **Desconectar**. O nome é atualizado no cartão e restaurado nos próximos acessos.

### Selecionar campanha

O botão **Campanha** abre a seleção sobre o mesmo céu animado do menu e da Lista de personagens, com dois capítulos vindos do PostgreSQL:

- **Capítulo 1 — Pondo o pé na estrada:** disponível, colorido com opacidade reduzida; no hover/foco fica vivo e amplia 1,15×.
- **Capítulo 2 — Nada era o que parecia:** bloqueado, preto e branco/escurecido, sem highlight ou escala no hover.

Número laranja e título branco têm contorno preto. Os botões laterais fazem a rolagem horizontal quando o conteúdo ultrapassa a área disponível, acompanhando o início/fim da lista. Novos registros da tabela `campaigns` aparecem sem alterar a interface. Clicar no capítulo disponível abre o mapa da campanha. A seta superior retorna ao menu.

O céu compartilhado é animado por `assets/video/sky-background.webm`: vídeo VP9 de 24 segundos, em loop e sem áudio, derivado da imagem original. O fundo permanece montado ao navegar entre início, autenticação, menu e personagens. Pausa com a aba oculta; em caso de falha/autoplay bloqueado ou `prefers-reduced-motion`, mantém o céu estático.

O catálogo vem de `/api/catalog`, consultando PostgreSQL, e todas as unidades retornadas aparecem na lista — atualmente 18. As três unidades iniciais são Ravi, Doko e Anna de Berdal; os demais bloqueios seguem o progresso da conta. **Fera Lendária e Exal - Verdadeiro poder são Premium**. A área de detalhes fica vazia até uma seleção. Equipe e desbloqueios vêm de `/api/progress`. As habilidades definitivas da transformação e dos novos inimigos continuam pendentes, registradas como provisórias nos metadados.

A ordem é: protagonistas → três saqueadores → Jung, Exal e Monnica de Grimória → Curandeiro e Curandeira de Pontes → Drak de Pontes → Trinity, Vlade e Passago de Espinea → Ravi Berserk → Exal - Verdadeiro poder → Fera Lendária. Nomes e posições vêm do banco; os IDs e caminhos de imagem permanecem estáveis.

### Mapa da campanha

O capítulo 1 abre um mapa animado (`assets/video/mapa-campanha-animado-v2.webm`, 1920×1080, 8 segundos em loop e sem áudio), com os **sete pontos de batalha** posicionados sobre a arte. O vídeo ocupa o mesmo espaço do mapa estático, preservando as coordenadas e os cliques dos pontos. A imagem `assets/imgs/mapa-campanha-01.png` funciona como fallback durante o carregamento, em caso de falha ou com movimento reduzido. O vídeo pausa em abas ocultas e é interrompido ao sair do mapa. Cada ponto:

- Mostra o número do combate; concluídos ganham ✓ e o próximo fica destacado, com rolagem para centralizá-lo.
- Bloqueado fica desabilitado e informa qual batalha anterior precisa ser vencida.
- Ao ser clicado, abre um **painel lateral** com o número e o título da batalha, os retratos dos adversários na ordem do encontro, o texto de história e o botão **Iniciar batalha**. Cada tentativa começa do zero.
- Exige equipe com ao menos uma unidade; sem equipe, o botão fica desabilitado com orientação.
- Erros da API aparecem dentro do painel, e Escape/clique fora fecha-o.

A progressão é sequencial e validada pelo servidor: vencer um ponto libera o seguinte. Repetir encontros concluídos é permitido. As equipes da primeira campanha são:

| Batalha | Adversários, em ordem |
|---|---|
| 1 | Saqueador da estrada I, Saqueador da estrada II, Saqueadora da estrada |
| 2 | Jung, Exal e Monnica de Grimória |
| 3 | Drak, Curandeiro e Curandeira de Pontes |
| 4 | Trinity, Vlade e Passago de Espinea |
| 5 | Jung, Exal e Monnica de Grimória |
| 6 | Jung e Exal de Grimória |
| 7 | Exal — Verdadeiro poder |

O ponto 6 fica na fronteira com as trevas, entre os pontos 5 e 7. No encontro final, abaixo da história aparece o requisito de **Ravi de Berdal na equipe**. O servidor valida esse requisito e inicia um duelo **1×1**, usando somente Ravi base, independentemente dos outros slots. No início do segundo turno de Ravi, depois da primeira rodada inimiga, ele é substituído por **Ravi Berserk**, com novo retrato/habilidades e preservação do HP proporcional e dos efeitos ativos. A transformação é registrada e persistida pelo servidor uma única vez; não altera a equipe salva nem concede o desbloqueio permanente de Berserk.

### Batalha

- A tela segue a composição dos templates de batalha e personagem: trios em colunas, personagens em linhas verticais e um cartão de papiro unificando retrato, HP, nome e habilidades. Os efeitos ativos aparecem como pequenos ícones acima das habilidades. Em telas estreitas os trios ficam um abaixo do outro, preservando a posição relativa das habilidades.
- **Encerrar turno** fica no topo central. Cada equipe tem sua própria barra de energia acima dos personagens. Escolher uma habilidade bloqueia as demais daquele personagem e debita imediatamente a energia, inclusive durante a seleção de alvo. Ações enfileiradas são removidas somente pelo × no combo central. Se a remoção deixar outra ação sem energia, ela é bloqueada e um modal orienta remover a dependente primeiro.
- Habilidades exibem somente seus ícones. O balão de nome, descrição e custo aparece após **1 segundo** de hover ou foco e fecha ao clicar, sair do ícone ou alterar a seleção. As informações também podem ser consultadas para habilidades desabilitadas.
- O servidor mantém um prazo de **45 segundos por turno** e encerra automaticamente turnos vencidos. Escolhas ainda não enviadas não são executadas no timeout. A IA aguarda **7 segundos** antes de resolver cada turno, inclusive os extras, e a tela bloqueia comandos enquanto o bot joga.
- A migração 015 persiste `turn_deadline_at` e `bot_acts_at`. Uma rotina do servidor verifica os prazos a cada segundo, independentemente da aba do jogador; consultas e comandos também verificam a expiração sob bloqueio transacional. A interface atualiza o contador e consulta a revisão oficial, sincronizando imediatamente ao recuperar o foco.
- **Registro do combate**, fixo no topo direito, abre um modal centralizado com as ações em uma área rolável e o anúncio da transformação quando aplicável. O registro é persistido em `battles.log`, sem truncamento, e retorna com o estado oficial.
- O servidor cria a batalha (`POST /api/encounters/:id/battles`), devolve o estado (`GET /api/battles/:id`) e resolve os turnos (`POST /api/battles/:id/turns`) com revisão e idempotência por `requestId`.
- Durante a batalha ativa, **Desistir** solicita o encerramento ao servidor (`POST /api/battles/:id/abandon`) antes de retornar ao mapa ou à Batalha rápida. O status `abandoned` é definitivo e não concede progresso. Cada início cria uma partida nova e encerra tentativas anteriores ainda ativas, inclusive após recarga; não há retomada.

### Fundos animados de batalha

A clareira das batalhas comuns/rápidas e o território das trevas do duelo final usam WebMs próprios, gerados a partir das imagens existentes: `assets/video/battle-clearing.webm` e `assets/video/battle-darkness.webm`. Ambos possuem **30 fps, 1600×900 e 12 segundos em loop (360 quadros)**, sem áudio. A clareira tem movimento suave de folhagem, nuvens e partículas de luz; o cenário final tem nuvens, névoa, brilho do portal e partículas roxas.

O vídeo fica atrás da interface, sem interceptar cliques, e continua do mesmo ponto ao selecionar habilidades ou trocar de turno. Pausa em abas ocultas e encerra ao sair da batalha. As imagens originais funcionam como fallback durante o carregamento, em caso de falha de reprodução ou com movimento reduzido. Detalhes e autoria em [`assets/video/README.md`](assets/video/README.md).

### Batalha rápida

O menu principal oferece **Batalha rápida**, um confronto independente do mapa. A página mostra uma explicação, as miniaturas dos adversários disponíveis e **Minha equipe** fixa no canto inferior esquerdo. O título segue o estilo da Lista de personagens e o painel central usa as cores de papiro.

Os três protagonistas estão disponíveis como adversários **desde o início**. Inimigos de encontros **já vencidos** na campanha são acrescentados ao conjunto. O servidor escolhe até três unidades diferentes para cada nova partida; uma unidade presente em mais de um encontro aparece uma única vez na lista. Basta escalar pelo menos uma unidade desbloqueada para jogar, mesmo antes de começar a campanha.

O combate usa as mesmas regras e rotas de turnos das batalhas da campanha. O sorteio, a equipe, os comandos e o resultado são persistidos em `battles`/`battle_commands`; batalhas rápidas têm `encounter_id = NULL`. Ao terminar, o jogador retorna à página de Batalha rápida. O resultado desse modo não avança a campanha nem concede suas recompensas.

### Desbloqueio de personagens

O botão **Desbloquear personagens** abre o hub com retratos, requisitos, barras de progresso e disponibilidade. Os dados são consultados ao abrir a página e ao retornar o foco à janela. Ao cumprir todas as metas, a unidade aparece automaticamente como disponível na Lista de personagens, sem avisos, toasts ou ação de resgate.

As regras de desbloqueio, incluindo a atualização da Tarefa 12, são definidas em `shared/content/unlocks.ts`:

- Saqueadores: 5 vitórias rápidas contra cada um.
- Jung: 10 vitórias rápidas usando **Ravi de Berdal** na equipe da partida.
- Exal de Grimória: 10 vitórias no **Multiplayer**, contabilizadas separadamente das rápidas.
- Monnica e os dois curandeiros: 10 vitórias rápidas contra cada personagem.
- Drak: 15 vitórias rápidas contra ele utilizando alguém de Berdal na equipe.
- Trinity e Vlade: 20 vitórias rápidas contra Grimorianos.
- Passago: completar simultaneamente 20 vitórias rápidas e 10 vitórias Multiplayer contra Grimorianos.
- Ravi Berserk: completar simultaneamente 15 vitórias rápidas contra Jung, 20 contra Exal, 10 contra Monnica e **50 vitórias rápidas no total**. Sua habilidade de proteção é **Guarda**.
- Exal — Verdadeiro poder e Fera Lendária: **US$ 9,90** cada, com **Adquirir personagem** desabilitado no hub e nos detalhes de unidades Premium bloqueadas.

Para essas condições, a equipe é a registrada no início da batalha, incluindo participantes derrotados ao final; alterações posteriores da escalação não modificam as metas. Na meta de Drak, “alguém de Berdal” inclui Ravi, Doko, Anna e Ravi Berserk. A exigência específica de Ravi de Berdal para Jung usa somente sua unidade base.

Nas metas de Espinea, Grimorianos são Jung, Exal de Grimória e Monnica: basta encontrar um deles na equipe adversária. Cada batalha vencida conta uma única vez, mesmo contendo dois ou três Grimorianos. Os modos são contabilizados separadamente; essas metas não exigem personagens específicos na equipe do jogador. O seed recalcula as vitórias históricas com as regras atuais.

O backend deriva a contagem das batalhas vencidas persistidas, uma vez por batalha e adversário. A gravação da vitória e a liberação dos personagens são transacionais e idempotentes. A migração `011_character_unlocks.sql` identifica o modo das partidas antigas; o seed reaproveita as vitórias históricas e sincroniza os desbloqueios. Drak e Ravi Berserk seguem essas metas em vez das antigas recompensas dos encontros 4 e 6; unidades já concedidas continuam disponíveis.

### Montar a equipe

- A conta começa com três slots vazios, representados por caixas cinza-escuras com ×.
- Selecione uma unidade desbloqueada e clique em **Adicionar à equipe**, fixo no rodapé do painel de descrição.
- No modal, escolha o **slot 1, 2 ou 3**. Um ocupante existente será substituído; escolher outra posição para uma unidade já escalada move a unidade, sem duplicá-la.
- O × de um slot ocupado remove a unidade. Alterações são gravadas no PostgreSQL e sobrevivem à recarga e ao login em outra sessão.
- A edição pode deixar a equipe vazia; a criação de batalha exige ao menos uma unidade.
- A gravação não mostra avisos de sucesso: a lista já reflete o novo estado. As miniaturas não exibem tooltip ao passar o mouse.

A interface usa fontes modernas sem serifa e botões alaranjados inspirados no logo. A tipografia e as cores compartilhadas são configuradas pelas variáveis de `styles.css`.

### Áudio

**Configurações** permite controlar volume e silêncio global de músicas e efeitos. Fora da batalha toca `base.mp3`; as batalhas 1–6 usam a clareira e `fight.ogg`. O duelo final usa `evil-fight-background.png` e `final-fight.mp3`. Músicas são reproduzidas em loop e respeitam as restrições de reprodução automática do navegador.

Todos os botões habilitados usam `click-menu.wav` fora da batalha e `click-battle.wav` na batalha. Mudanças oficiais de turno emitem `change-turn.wav`; cada novo evento de personagem derrotado, aliado ou inimigo, emite `player-death.wav`. Ao concluir uma batalha, `battle-win.wav` toca na vitória e `battle-lose.mp3` na derrota, uma vez por resultado oficial e respeitando volume/silêncio. Simulações do combo e releitura de eventos históricos não disparam esses efeitos.

Loja demonstrativa, Multiplayer e diálogos guiados seguem no backlog. A versão atual de [`todo-list.md`](todo-list.md) tem as tarefas 01–04 concluídas; a tarefa 05 de arquitetura foi excluída desta entrega.

## Requisitos

- Node.js 22.12 ou superior e npm.
- PostgreSQL 17, ou Docker Desktop com o mecanismo em execução.

## Executar localmente

Na raiz do projeto:

```powershell
npm install
Copy-Item .env.example .env
npm run db:up
npm run db:migrate
npm run dev
```

Abra **http://127.0.0.1:5173**. A API usa `http://127.0.0.1:3001`; o Vite encaminha `/api` para ela. Use o endereço exato configurado em `APP_ORIGIN`, inclusive o hostname e a porta.

Se utilizar PostgreSQL já instalado, configure `DATABASE_URL` no `.env` e pule `db:up`. O arquivo `.env.example` usa credenciais apenas de desenvolvimento e o `.env` é ignorado pelo Git.

Não abra mais o `index.html` diretamente: a aplicação agora precisa do Vite/API e do PostgreSQL.

### Comandos

| Comando | Finalidade |
|---|---|
| `npm run dev` | Frontend e API com atualização automática |
| `npm run dev:web` | Somente Vite |
| `npm run dev:api` | Somente API |
| `npm run db:up` | Iniciar PostgreSQL no Docker |
| `npm run db:down` | Parar o container, preservando o volume |
| `npm run db:migrate` | Aplicar migrações SQL e inicializar o catálogo |
| `npm run db:seed` | Reexecutar o seed idempotente do catálogo |
| `npm run assets:mocks` | Regenerar PNGs transparentes e JPEGs dos ícones; requer Sharp apenas na autoria |
| `npm run assets:campaigns` | Regenerar somente as imagens dos dois cards de capítulos; requer Sharp apenas na autoria |
| `npm run assets:sky` | Regenerar o WebM do céu; requer FFmpeg apenas para autoria |
| `npm run assets:battles` | Regenerar os dois cenários de batalha a 30 fps; requer FFmpeg apenas para autoria |
| `npm run typecheck` | Verificar os tipos do frontend e backend |
| `npm test` | Testes HTTP, criptografia e interface, sem banco externo |
| `npm run test:db` | Integração com PostgreSQL real em banco exclusivo |
| `npm run build` | Gerar `dist/` e `build/` |
| `npm start` | Executar API compilada; em produção também serve `dist/` |

### Testes com PostgreSQL

Com o container em execução, crie o banco de testes uma única vez:

```powershell
docker compose exec -T db createdb -U rave_trail rave_trail_test
npm run test:db
```

`TEST_DATABASE_URL` está exemplificada no `.env.example`. Os testes truncam as tabelas desse banco. O comando rejeita uma URL igual à de desenvolvimento ou cujo nome de banco não termine em `_test`.

As migrações são aplicadas automaticamente apenas nos testes de banco. Para executar a aplicação, use `npm run db:migrate` explicitamente.

## Autenticação e API

| Método | Rota | Resultado |
|---|---|---|
| `POST` | `/api/auth/register` | Cadastra `{ email, password }` e autentica |
| `POST` | `/api/auth/login` | Autentica `{ email, password }` |
| `POST` | `/api/auth/logout` | Revoga a sessão atual |
| `GET` | `/api/auth/me` | Retorna `{ user: { id, email, name, sessionExpiresAt } }` |
| `PATCH` | `/api/profile` | Salva `{ name }` na conta autenticada e retorna o usuário atualizado |
| `GET` | `/api/progress` | Retorna o progresso da conta autenticada |
| `GET` | `/api/catalog` | Retorna personagens, unidades, habilidades e caminhos das imagens do PostgreSQL |
| `GET` | `/api/character-unlocks` | Retorna metas, progresso de vitórias, disponibilidade e preços do hub da conta autenticada |
| `GET` | `/api/campaigns` | Retorna capítulos ordenados e disponibilidade da conta autenticada |
| `PUT` | `/api/team/slots/:slot` | Salva `{ unitId: string ou null }` em um slot de 0 a 2, retornando `{ team }` |
| `GET` | `/api/campaigns/:id/map` | Retorna os encontros do caminho com disponibilidade/conclusão da conta |
| `POST` | `/api/encounters/:id/battles` | Cria uma nova tentativa do encontro com HP/energia iniciais |
| `GET` | `/api/quick-battle` | Lista os adversários já derrotados disponíveis para Batalha rápida |
| `POST` | `/api/quick-battle/battles` | Sorteia adversários e cria uma nova Batalha rápida com a equipe escalada |
| `GET` | `/api/battles/:id` | Devolve o estado oficial de uma batalha da conta |
| `POST` | `/api/battles/:id/turns` | Resolve um turno com `revision` e `requestId` idempotentes |
| `POST` | `/api/battles/:id/abandon` | Encerra definitivamente uma batalha ativa por desistência |

- E-mail normalizado com remoção de espaços externos e conversão para minúsculas.
- Senha de 10 a 128 caracteres, sem remoção de espaços, com hash `scrypt` e salt individual.
- Sessão opaca de 256 bits, válida por **uma hora absoluta** após cadastro/login, sem renovação por atividade. PostgreSQL armazena apenas o hash do token. Respostas de autenticação incluem `name` e `sessionExpiresAt`; o cliente volta ao login no prazo, inclusive ao recuperar o foco. A migração 017 limita também as sessões antigas a uma hora desde sua criação.
- Cookie `HttpOnly`, `SameSite=Lax`, host-only e `Secure` em produção. Login substitui e revoga o cookie anterior apresentado; logout revoga a sessão no banco.
- Mutações exigem o cabeçalho `Origin` igual a `APP_ORIGIN`. Clientes de API manuais também devem enviá-lo.
- Cadastro e login possuem limite de dez tentativas por minuto por IP, por rota.
- Sem confirmação de e-mail ou login social nesta versão.
- Não há endpoint para o cliente conceder recompensas ou substituir o progresso: batalhas, progressão e recompensas são calculados pelo backend.

O navegador não armazena banco de dados, senhas ou tokens em `localStorage`, `sessionStorage` ou IndexedDB. O cookie de sessão é gerenciado pelo navegador. Acesso e persistência requerem conexão com o servidor.

## Estrutura

```text
src/                       Frontend React e cliente HTTP
src/features/characters/   Lista, miniaturas, painel e arte vetorial provisória
src/features/campaigns/    Seleção de capítulos, carrossel e mapa da campanha
src/features/battle/       Arena, planejador de combo e registro de combate (lazy)
src/components/            Céu animado compartilhado
shared/contracts.ts        Contratos e progresso inicial versionado
shared/content/            Personagens, unidades, habilidades, campanhas e encontros
shared/core/battle.ts      Motor puro de combate (cliente e servidor)
server/app.ts              Rotas, cookies, validação e autenticação
server/auth/               Contratos do repositório e criptografia
server/game/               Contratos do catálogo/equipe/batalha e erros de domínio
server/db/                 Adaptador PostgreSQL, repositórios e executor de migrações
server/db/migrations/      Esquema SQL versionado
server/battle-core.test.ts Testes do motor de combate puro
assets/imgs/               Logo, céu, cenário de batalha e mapa da campanha
assets/video/              Céu WebM derivado do asset existente
public/media/characters/   PNGs mockados, incluindo corpo inteiro com alpha
public/media/abilities/    Ícones JPEG mockados de cada habilidade
public/media/campaigns/    Fundos dos cards dos capítulos
scripts/generate-mock-art.mjs  Geração dos assets mockados com Sharp
scripts/generate-sky.mjs   Geração reproduzível do céu com FFmpeg
assets/scripts/app.js      Script legado preservado, não carregado pela aplicação
docs/decisions.md          Registro de decisões técnicas
product.md                 Especificação oficial do MVP
implementation_tasks.md    Backlog com dependências, aceite e testes
```

`shared/content/` fornece as definições do seed, com IDs estáveis. A interface lê os dados efetivos da API/PostgreSQL, sem usar o catálogo estático como fallback. `shared/core/battle.ts` é o motor determinístico usado pela previsão do cliente e pela resolução oficial do servidor.

### Tabelas no DBeaver

Além de `users`, `sessions`, `player_progress` e `schema_migrations`, a migração `002_catalog_and_team.sql` cria:

- `narrative_characters`: indivíduos narrativos;
- `units`: versões jogáveis, nomes, atributos, desbloqueios e caminhos dos PNGs;
- `abilities`: nomes, custos, alvos, efeitos e caminhos dos JPEGs;
- `unit_abilities`: quatro habilidades ordenadas por unidade;
- `player_team_slots`: três posições por conta, com unidade opcional.
- `campaigns`: capítulos, número, título, descrição, fundo, ordem e estado de lançamento (migração 003).
- `encounters`, `encounter_enemies`, `encounter_rewards`: os sete encontros do caminho 1, com posição, coordenadas no mapa, equipe inimiga e recompensas (migração 005).
- `battles`, `battle_commands`: estado oficial de cada batalha, revisão do turno e comandos processados de forma idempotente (migração 005).

Atualize o schema `public` no DBeaver após executar `npm run db:migrate`. O catálogo inclui 16 personagens narrativos, 18 unidades e 15 habilidades; todas as unidades aparecem na lista visual. A migração 004 registra `rival-b-final-mode` como Premium, assim como a Fera Lendária. A 017 adiciona `users.name` e encurta as sessões; a 018 aplica as formações da primeira campanha. Imagens ficam nos arquivos estáticos; o banco guarda seus caminhos.

A tabela `campaigns` começa com apenas `path-1` e `path-2`. Para acrescentar campanhas, insira registros com `chapter_number`, `title`, `description`, `background_path`, `sort_order` e `released`. A disponibilidade exige tanto `released=true` quanto o ID em `availablePathIds` do progresso. O seed preserva capítulos extras e o estado de lançamento já existente.

Inimigos posteriores a Drak já cadastrados: `guerreiros-habilidosos-a`, `guerreiros-habilidosos-b`, `guerreiros-habilidosos-c` e `rival-b-final-mode`. A forma final compartilha a identidade narrativa `rival-b` com a versão original, sem substituí-la. As formações dos encontros estão definidas em `shared/content/encounters.ts` e persistidas no PostgreSQL.

A migração/seed converte a antiga equipe automática dos três protagonistas para vazia e preserva equipes personalizadas existentes. A equipe passa a ter fonte única em `player_team_slots`; o campo antigo é retirado do JSONB de progresso. Reexecutar o seed não apaga equipes já migradas nem sobrescreve custos/efeitos ou conjuntos de habilidades existentes.

O seed remapeia nomes e ordem em uma transação. Antes de reaplicar as posições do catálogo gerenciado, libera essas posições para evitar conflitos do índice único em trocas de ordem. Equipes, desbloqueios, imagens e regras de combate são preservados.

## Build e produção

```powershell
npm run build
npm run db:migrate
$env:NODE_ENV = "production"
$env:APP_ORIGIN = "https://seu-dominio.example"
npm start
```

Configure `DATABASE_URL` para o PostgreSQL do ambiente e coloque a API atrás de um proxy HTTPS no mesmo domínio do frontend. Em produção, `APP_ORIGIN` precisa usar HTTPS e não deve incluir caminho ou barra final. `HOST` e `PORT` controlam o endereço de escuta interno.

O build serve somente os arquivos de `dist/`; o código-fonte, `.env` e migrações não são publicados como arquivos estáticos. Execute as migrações a partir do checkout com as dependências de desenvolvimento instaladas, antes de iniciar o serviço.

## Assets e conteúdo pendente

Logo, céu, clareira, mapa da campanha e template foram preservados. Há 36 PNGs mockados originais, com alpha, e nove ícones JPEG. Os avisos de arte provisória foram retirados da interface conforme solicitado; o status temporário continua documentado. Para regenerar as imagens, instale Sharp como ferramenta de autoria ou defina `SHARP_PATH` para seu módulo e execute `npm run assets:mocks`; o jogo utiliza os arquivos prontos e não depende de Sharp. É possível gerar somente unidades específicas passando seus IDs, por exemplo `npm run assets:mocks -- rival-b-final-mode`, sem regravar os demais assets.

As composições dos sete encontros foram aprovadas e não exibem mais o aviso de formação provisória. O seed sincroniza exatamente os inimigos e seus slots, removendo integrantes antigos excedentes; snapshots de batalhas anteriores são preservados. O cenário e os áudios fornecidos foram integrados, assim como o duelo final com transformação. Diálogos/desfechos guiados e futuras revisões de habilidades permanecem evoluções independentes.
