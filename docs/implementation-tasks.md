# Rave Trail — Tarefas de implementação

Estrutura e comandos atuais: [architecture.md](architecture.md). As tabelas abaixo preservam o histórico de implementação do MVP.

## Entrega atual — 2026-10-31

As duas tarefas da versão atual de `../todo-list.md` foram concluídas: requisitos das Missões nos próprios cartões, bloqueio visual por progresso de campanha e reorganização física/lógica em frontend, backend, shared, ferramentas, documentação e mídia canônica. A validação atual tem 219 testes gerais, 57 com PostgreSQL, tipos por camada, build, teste do executável de produção e verificações em navegador. As fases históricas abaixo não substituem essa entrega nem a documentação de arquitetura atual.

**Atualização:** 2026-10-29. **Fonte de verdade:** `product.md`.

O MVP é full-stack: React/TypeScript/Vite, API Node.js/Fastify e PostgreSQL. Não utilizar banco de dados no navegador. Multiplayer e pagamentos reais continuam fora do escopo.

## Como acompanhar

- `[x]`: implementado e verificado no escopo descrito.
- `[ ]`: pendente. A conclusão de uma tela não implica conclusão do fluxo correspondente.
- Cada tarefa depende das identificadas na coluna “Depende de”.
- Manter o projeto executável ao final de cada fase.
- Uma tarefa só está concluída quando cumprir o aceite e a verificação associada.
- IDs de unidades e contratos aprovados devem permanecer estáveis durante a evolução.

## Regras consolidadas

- Jogador inicia; HP cheio e energia zerada antes da regeneração em cada batalha.
- Regeneração de **15** por turno, inclusive turnos extras; Reter energia recupera **15**; teto de **100**.
- Uma habilidade por personagem vivo por turno; fila executada sequencialmente; passar turno é permitido.
- A barra reflete o custo ao enfileirar. Novo clique remove a ação, e a fila avança mantendo a ordem. Recalcular ao editar; não cobrar duas vezes na confirmação.
- Ataque cujo alvo foi derrotado anteriormente no combo gera **MISS**, mantendo custo e ação consumida. Sem redirecionamento ou reembolso.
- Turnos extras acumuláveis, sem cooldown ou limite artificial.
- Guarda reduz 10 por golpe, sem somar reduções. Reaplicação renova duração; expira no início da segunda oportunidade de agir da equipe protegida após aplicação, incluindo turnos extras.
- Equipes de uma a três unidades, sem repetir a mesma unidade. Versões diferentes do mesmo personagem são permitidas.
- Repetir encontros é permitido; recompensas não duplicam.
- Contas, sessões e progresso pertencem ao servidor. O cliente não pode conceder unidades ou declarar resultados oficiais.

## Confirmações pendentes do planejador

| ID | Proposta | Impacto |
|---|---|---|
| Q01 | Reter energia também aumenta imediatamente a barra prevista ao ser enfileirado, considerando sua posição | Interação de T16/T25 |
| Q02 | Uma edição que torne a fila inviável mantém as ações visíveis, sinaliza insuficiência e bloqueia confirmação | Interação de T16/T25 |

Não tratar essas duas propostas como regras aprovadas. A validade sequencial da energia e o consumo imediato exibido para habilidades com custo já estão definidos. O restante do desenvolvimento pode avançar independentemente dessas confirmações.

## Fase 0 — Especificação e base full-stack

| Estado / ID | Tarefa | Depende de | Critério de aceite | Verificação |
|---|---|---|---|---|
| [x] T01 | Incorporar decisões aprovadas em `product.md` | — | Documento coerente sobre PostgreSQL, autenticação, energia 15, MISS e acúmulo de turnos extras | Revisão das seções impactadas |
| [x] T02 | Criar backlog e registro de decisões técnicas | T01 | Tarefas com dependências, aceite e testes; propostas separadas de aprovações | Revisão deste arquivo e de `docs/decisions.md` |
| [x] T03 | Configurar React, TypeScript, Vite e ferramentas da API | T01 | Scripts de desenvolvimento, tipos, testes e build executáveis | `npm run typecheck`, `npm test`, `npm run build` |
| [x] T04 | Configurar PostgreSQL e migrações versionadas | T03 | Compose, tabelas de contas/sessões/progresso, trava de migração e reexecução segura | Migração aplicada e reaplicada em PostgreSQL real |

## Fase 1 — Autenticação e entrada no jogo

| Estado / ID | Tarefa | Depende de | Critério de aceite | Verificação |
|---|---|---|---|---|
| [x] T05 | Implementar cadastro transacional | T04 | E-mail normalizado e único; senha com hash/salt; conta, progresso e sessão criados atomicamente | HTTP válido/inválido; concorrência e rollback em PostgreSQL |
| [x] T06 | Implementar login e sessões | T05 | Login com mensagem genérica de erro, sessão opaca de sete dias, rotação e cookies apropriados | Senha correta/incorreta, conta ausente, cookies, expiração e token adulterado |
| [x] T07 | Implementar logout e leitura autenticada | T06 | Logout revoga sessão; `/auth/me` e `/progress` usam a conta da sessão | Revogação, acesso sem sessão e isolamento entre contas |
| [x] T08 | Validar entradas e proteger mutações de autenticação | T06 | Origem exata, limite de tentativas, limite de corpo e respostas sem credenciais | Origem ausente/externa, rate limit e ausência de hash/token no JSON |
| [x] T09 | Migrar tela inicial e integrar login/cadastro | T07 | Assets preservados; cadastro, login, restauração e logout pela interface, com feedback | Testes de formulário, sessão existente e erro recuperável |
| [x] T10 | Documentar ambiente, comandos e contratos HTTP | T09 | README permite configurar API, banco, migrações e testes; limitações atuais explícitas | Conferência com scripts e estrutura reais |
| [ ] T11 | Implementar menu principal e navegação do jogo | T09 | Campanha, personagens, loja e configurações navegáveis; Multiplayer desabilitado; botões somente com nomes e logo acima; acesso exige sessão | Navegação, retorno, sessão expirada e teclado |

**Marco atual:** fundação full-stack, autenticação, Lista de personagens/equipe, seleção de campanha, mapa da campanha, motor de combate e batalhas autoritativas entregues. O menu abre personagens, campanhas e o mapa ligado a elas; loja e configurações continuam em desenvolvimento, mantendo T11 pendente.

## Fase 2 — Catálogo e contratos do jogo

| Estado / ID | Tarefa | Depende de | Critério de aceite | Verificação |
|---|---|---|---|---|
| [x] T12 | Modelar personagens, unidades, habilidades e encontros compartilhados | T03 | Separação entre indivíduo, versão jogável e estado; catálogo independente de React/HTTP/SQL | IDs únicos, quatro habilidades e referências válidas |
| [x] T13 | Cadastrar catálogo de protagonistas e inimigos dos encontros 1–3 | T46 | Valores e habilidades correspondem ao produto; definições únicas preparadas para IA/jogador; IDs iniciais preservados; nomes aprovados no PostgreSQL | Integridade do conteúdo, seed e leitura do catálogo persistido |
| [x] T14 | Proteger imutabilidade e revisão do conteúdo | T13 | Resolver batalhas não altera definições; novas versões não sobrescrevem unidades existentes | Regressão das definições antes/depois de sequências de combate |

**T12/T13/T14 concluídos:** `shared/content` define unidades, habilidades, campanhas e os sete encontros (`campaignId`, `position`, `mapX/mapY`, inimigos, recompensas e `provisional`), com provas de IDs únicos, quatro habilidades e referências válidas; `battle-core.test.ts` confirma que resolver batalhas não modifica definições nem estado de entrada.

## Fase 3 — Motor puro de combate

| Estado / ID | Tarefa | Depende de | Critério de aceite | Verificação |
|---|---|---|---|---|
| [x] T15 | Implementar estado inicial e ciclo de turnos | T13 | Estado serializável; jogador inicia; HP cheio; reservas iniciais zeradas e +15 por início de turno; limites respeitados | HP, energia inicial, regeneração e teto de 100 |
| [x] T16 | Implementar comandos, fila e simulador energético | T15; Q01/Q02 para a interação final | Uma ação por personagem vivo; sequência validada; recuperação intermediária; edição recalcula saldo | Recuperação no meio da fila, remoção/reordenação, custo acima do saldo e ausência de cobrança duplicada |
| [x] T17 | Implementar dano simples, forte e especiais ofensivos | T16 | Custos e danos corretos; ataques AOE afetam inimigos vivos | Dano 20/30/35 e especial AOE de 15 por alvo |
| [x] T18 | Implementar cura e Guarda individual/AOE | T17 | Cura limitada ao HP máximo; proteção por golpe, sem acúmulo; duração por turnos da equipe | Cura 30, múltiplos golpes, reaplicação, expiração e Guarda AOE |
| [x] T19 | Implementar MISS e encerramento da batalha | T18 | Alvo derrotado anteriormente no combo gera MISS com custo; personagens derrotados não agem; resultado encerra resolução | MISS sem reembolso/redirecionamento, vitória, derrota e comandos após encerramento |
| [x] T20 | Implementar turnos extras acumuláveis | T19 | Cada uso adiciona turno; fila termina antes da transição; +15 e novas ações por unidade viva | Acúmulo, Guarda em turno extra e ciclo energético com saldo −5 |
| [x] T21 | Implementar IA determinística configurável | T20 | Planeja comandos válidos, considera cura/proteção/especiais, respeita a mesma energia e não usa dados ocultos | Mesma entrada produz mesma fila; cenários de cura, ataque, proteção e Turno extra |

Motor puro entregue em `shared/core/battle.ts`, sem dependências de React, HTTP ou SQL. Q01 e Q02 continuam pendentes de confirmação e afetam somente o detalhe final da interação do planejador, não as regras já aprovadas.

## Fase 4 — Batalha autoritativa no backend

| Estado / ID | Tarefa | Depende de | Critério de aceite | Verificação |
|---|---|---|---|---|
| [x] T22 | Persistir batalhas oficiais e comandos processados | T04, T20 | Migração para estado serializável, proprietário, revisão do turno e identificadores de comandos | Round-trip PostgreSQL, migração e estado preservado em nova instância |
| [x] T23 | Implementar criação e consulta autenticadas de batalhas | T14, T22 | Servidor valida encontro disponível, equipe desbloqueada e tamanho; jogador só acessa a própria batalha | Equipe vazia/bloqueada/duplicada, encontro bloqueado e acesso cruzado |
| [x] T24 | Implementar submissão e resolução oficial de turnos | T21, T23 | Servidor valida fila/revisão, resolve jogador e IA, retorna eventos e grava atomicamente; reenvio não executa duas vezes | Turno duplicado/antigo, concorrência, comandos adulterados e falha transacional |

Migração `005_encounters_and_battles.sql` e repositório `server/db/battle-repository.ts` fornecem criação/consulta de batalhas (`POST /api/encounters/:id/battles`, `GET /api/battles/:id`) e turnos (`POST /api/battles/:id/turns`), com revisão do turno, idempotência por `commandId` e início bloqueado para encontros sequenciais. Roteamento em `server/app.ts` com repositório em `server/game/battle-repository.ts`.

## Fase 5 — Primeiro combate completo na interface

| Estado / ID | Tarefa | Depende de | Critério de aceite | Verificação |
|---|---|---|---|---|
| [x] T25 | Construir arena e planejador de combo | T11, T16, T23; Q01/Q02 | Clareira existente, equipes, HP, energia, quatro habilidades, escolha de alvos, fila editável e débito imediato exibido | Seleção, remoção por novo clique, reordenação e prévia sequencial |
| [x] T26 | Apresentar resolução, efeitos e sincronização | T24, T25 | Dano, cura, Guarda, energia, MISS e turno extra visíveis; bloquear submissão repetida; recuperar estado após falha de rede | Feedback por evento, erro/reenvio e redução de movimento |
| [x] T27 | Entregar encontro 1 de ponta a ponta | T26 | Introdução prática, combate contra IA, vitória/derrota e retorno; resultado calculado no backend | Partidas completas vencida e perdida, recarga e estado oficial |

**Marco de validação:** aprovar o primeiro combate jogável antes de expandir conteúdo. Valorizado: o primeiro encontro foi vencido em navegador real em sete turnos, com recompensa e desbloqueio conferidos no servidor.

**Dependência de T11:** T25 usa T11 apenas para o acesso à batalha, que hoje ocorre pelo mapa da campanha. T11 segue pendente somente por Loja não implementada e Configurações de áudio ainda não entregues.

## Fase 6 — Campanha, narrativa e recompensas

| Estado / ID | Tarefa | Depende de | Critério de aceite | Verificação |
|---|---|---|---|---|
| [x] T28 | Integrar sete encontros e progressão à seleção de campanha | T27, T49 | Seleção extensível entregue; primeiro capítulo com sete encontros e progressão sequencial validada pelo backend | Bloqueio de encontros e desbloqueio do próximo |
| [x] T29 | Integrar encontros 2–3 e desbloqueio do chefão | T28 | Equipes corretas; vitória no quarto libera a unidade do chefão transacionalmente (Drak depende dos Grimorianos no combate 3) | Recompensa persistente, repetição sem duplicação e derrota sem avanço |
| [x] T30 | Configurar encontros 4–7 e versões provisórias | T29 | Encontros jogáveis; reutilizar habilidades existentes; conteúdo temporário explicitamente identificado | Integridade do catálogo e preservação de versões anteriores |
| [ ] T31 | Implementar transformação e conclusão do caminho | T30 | Combate 6 libera unidade transformada independente com quatro habilidades provisórias; 7 conclui caminho | Desbloqueio correto, reenvio de resultado e persistência |
| [ ] T32 | Integrar diálogos e narrativa dos sete encontros | T31 | Introdução/desfecho por encontro; nomes configuráveis e progressão gradual dos poderes | Revisão narrativa e navegação antes/depois de vitória/derrota |

**Avanço de Fase 6:** página do mapa da campanha (`src/features/campaigns/CampaignMap.tsx`) com os sete pontos sobre `assets/imgs/mapa-campanha-01.png`, painel lateral com título, três retratos, história, aviso de encontro provisório, "Iniciar batalha"/"Retomar batalha" e atalho "Montar equipe". Desbloqueio sequencial validado pelo servidor; Drak liberado somente por vencer os Grimorianos no combate 3. Recompensas idempotentes: Drak no combate 4 e Ravi Berserk no combate 6. T31 permanece pendente pela conclusão do caminho no combate 7 e pelas habilidades próprias da transformação; T32, pelos desfechos pós-combate e diálogos guiados.

## Fase 7 — Equipe, loja e áudio

| Estado / ID | Tarefa | Depende de | Critério de aceite | Verificação |
|---|---|---|---|---|
| [ ] T33 | Completar lista visual integrada à campanha | T11, T30, T41 | Mostrar todo o catálogo e refletir desbloqueios reais; bloqueados e Premium podem ser consultados, mas não escalados | Desbloqueios dos combates 4 e 6 refletidos na lista e versões preservadas |
| [x] T34 | Implementar seleção e gravação da equipe | T07, T41, T46 | Três slots persistentes, inicialmente vazios; escolha de posição, substituição, movimento sem duplicação e remoção; backend rejeita bloqueados e isola contas | HTTP, PostgreSQL real, concorrência, erros recuperáveis e recarga no navegador |
| [ ] T35 | Implementar loja demonstrativa | T33 | Besta premium com quatro habilidades provisórias, descrição e “Disponível futuramente”; indisponível para seleção | Ausência de concessão fictícia e bloqueio premium no backend |
| [ ] T36 | Implementar preferência de áudio e reprodução | T07, T11 | Endpoint autenticado persiste toggle por conta; sons respeitam preferência e interação inicial do navegador | Salvar/recarregar, isolamento entre contas e ligar/desligar |

## Entrega antecipada — Lista de personagens solicitada pelo usuário

| Estado / ID | Tarefa | Depende de | Critério de aceite | Verificação |
|---|---|---|---|---|
| [x] T41 | Implementar lista conforme o template e acesso pelo menu | T07, T09 | Seta de retorno e título; face-thumbs com highlight; catálogo completo consultável, sem escalação de bloqueados; detalhes e equipe vindos da API | Navegação de ida/volta, seleção exclusiva, teclado, bloqueios, equipe recebida, falha/retry e sessão expirada |
| [x] T42 | Reorganizar menu e adicionar cartão de perfil com modal | T06, T09 | Menu fixo no alto à esquerda com logo acima dos itens, sem painel/retorno/setas/textos auxiliares; cartão branco fixo embaixo à direita com foto/nickname provisórios e e-mail real; modal de detalhes com desconexão | Logo e nomes dos itens, abertura do perfil somente pelo cartão, fechamento sem logout, desconexão e retorno à tela inicial, erro recuperável no modal |
| [x] T43 | Animar céu compartilhado com WebM | T09, T41 | WebM derivado do asset original em loop sem áudio; fundo persistente entre telas; imagem estática de fallback; respeitar redução de movimento e pausar em aba oculta | Cinco testes de reprodução/preferência/falha/visibilidade, tipos, build e decodificação dos 576 frames do vídeo |
| [x] T44 | Modernizar tipografia/cores e simplificar a lista | T41, T42 | Fonte sans-serif moderna, botões alaranjados, seis unidades intencionais em grade 3×2 e área de detalhes vazia antes da seleção | Teste das seis miniaturas, ausência de painel inicial, seleção/bloqueios preservados, tipos e build |
| [x] T45 | Distribuir a lista pelos cantos e melhorar contraste | T41, T44 | Equipe no canto inferior esquerdo, detalhes no inferior direito, textos auxiliares removidos, habilidades/nome/descrição em painéis opacos e bloqueados escurecidos sobre preto | 36 testes, tipos, build e validação em Edge nas resoluções 1920×1080, 1366×768, 1024×768 e 390×844, sem overflow horizontal |
| [x] T46 | Persistir catálogo, imagens e slots no PostgreSQL | T04, T41 | Migração 002, seed idempotente, 13 identidades, 14 unidades, nove habilidades, loadouts e três slots por conta; preservar equipes personalizadas na migração | Banco real, seed reaplicável, catálogo vindo do banco, transações, concorrência e isolamento |
| [x] T47 | Atualizar detalhes, nomes e escalação visual | T34, T46 | Painel em toda a altura disponível, corpo inteiro em PNG com alpha sem fundo, ícones JPEG, nomes aprovados sem versão/HP, consulta de bloqueados com cadeado e botão fixo de adicionar com escolha de slot | 43 testes sem banco, oito com PostgreSQL, build, PNG com alpha verificado e navegador com persistência real após reload |
| [x] T48 | Popular inimigos posteriores a Drak | T46 | Guerreiros habilidosos A/B/C e `rival-b-final-mode` persistidos, com quatro habilidades existentes temporárias, imagens PNG próprias e versão original do rival B preservada | Integridade do catálogo, seed reaplicado sem duplicatas, leitura dos quatro registros no PostgreSQL, tipos, testes e build |
| [x] T49 | Implementar seleção de campanha extensível | T07, T42, T46 | Migração 003 e dois capítulos iniciais; céu compartilhado e imagens próprias dos cards; disponível com hover 1,15×/cores vivas, bloqueado escuro PB sem hover; setas horizontais e retorno ao menu | HTTP, banco real, seleção/bloqueios, expansão por dados, retry/sessão e navegador em quatro resoluções, incluindo seis capítulos temporários no teste |
| [x] T50 | Centralizar personagem e expandir a lista completa | T41, T47, T48 | Cinco miniaturas por linha com gap 6/4 px; imagem/nome no centro exato, dados à direita; todos os registros da API visíveis; migração 004 para rival B final Premium; campanhas com o céu compartilhado | 54 testes, 11 com PostgreSQL, tipos, build e Edge em cinco tamanhos com medição de coordenadas, catálogo completo, bloqueios, Premium e ausência de fundo exclusivo na campanha |
| [x] T51 | Remapear nomes e ordem dos personagens | T46, T50 | Nove nomes atualizados; 18 posições na sequência aprovada, Fera Lendária por último; seed reordena transacionalmente sem conflitos; IDs, imagens, equipe, desbloqueios e habilidades preservados | Catálogo puro, PostgreSQL com ordem antiga simulada e seed reaplicado, consulta ao banco de desenvolvimento e conferência da ordem renderizada no navegador |

T41/T47/T50 entregam consulta de todo o catálogo em cinco colunas, inclusive bloqueados/Premium, e T34 entrega edição persistente da equipe. A imagem com nome está centralizada e os dados ficam à direita. A interface não exibe os avisos de arte provisória removidos pelo usuário.

**Ajuste visual de T41:** lista sem fundo próprio, utilizando o céu compartilhado com o menu; cabeçalho, grade e estados de carregamento/erro alinhados à esquerda, com o mesmo recuo dos itens do menu. Espaçamentos compartilhados por variáveis CSS. Build aprovado após o ajuste; testes funcionais não foram repetidos por se tratar de alteração de estilos.

## Fase 8 — Validação e entrega do MVP

| Estado / ID | Tarefa | Depende de | Critério de aceite | Verificação |
|---|---|---|---|---|
| [ ] T37 | Completar matriz de testes das regras e da API | T32, T34–T36 | Todos os casos obrigatórios da seção 25 cobertos; falhas de rede, isolamento e idempotência incluídos | `npm test`, `npm run test:db` e revisão da matriz |
| [ ] T38 | Validar jornada completa em navegador | T37 | Cadastro → equipe → sete encontros → desbloqueios → logout/login; derrota, repetição e recarga funcionam | Percurso real e cenários de perda de conexão |
| [ ] T39 | Revisar acessibilidade e responsividade | T38 | Teclado, foco, legibilidade, estados dos controles e `prefers-reduced-motion` | Navegação por teclado e diferentes tamanhos de tela |
| [ ] T40 | Consolidar documentação e publicação | T39 | README, ambiente, migrações, estrutura, conteúdo provisório e pendências atualizados; build executável | Tipos, build e smoke test da aplicação publicada |

## Matriz de rastreabilidade dos testes obrigatórios

| Casos de `product.md`, seção 25 | Tarefas responsáveis |
|---|---|
| 1–3: dano simples, forte e cura | T17, T18 |
| 4–6: teto, regeneração 15 e Reter energia | T15, T16 |
| 7–10: Guarda, expiração e efeitos AOE | T17, T18 |
| 11–13: fila, limite de ações e derrotados | T16, T19 |
| 14–17: resultados e turnos extras | T19, T20 |
| 18–20: desbloqueio, persistência e imutabilidade | T14, T22, T29 |
| 21–24: MISS, acúmulo, edição da fila e Guarda | T16, T18–T20 |
| 25–27: autenticação e controles HTTP | T05–T08 |
| 28: isolamento entre contas | T07, T23, T34, T36 |
| 29–30: transações, migrações e persistência | T04, T05, T22 |
| 31: idempotência de comandos/recompensas | T24, T29, T31 |
| 32–35: catálogo persistido, slots, consulta de bloqueados e migração | T13, T34, T46, T47 |
| 36–38: seleção de campanha, disponibilidade por conta e expansão | T49 |
| 39–40: catálogo completo e condições Premium | T50 |
| 41: nomes, ordem e reordenação segura do seed | T51 |
| 42–43: mapa, progressão sequencial, painel do encontro e exigência de equipe | T28, T29 |

## Verificação da base entregue

- `npm run typecheck`: aprovado (frontend e servidor).
- `npm test`: **87 testes** aprovados em 10 arquivos, cobrindo motor de combate (dano, cura, Guarda, fila, MISS, turnos extras, IA e vitória real em sete turnos), catálogo, nomes/ordem, Premium, autenticação, equipe, campanhas, mapa (sete pontos, desbloqueio sequencial de Drak) e planejador de combo.
- `npm run test:db`: **18 testes** aprovados com PostgreSQL 17 real, incluindo reordenação de posições antigas, seed reaplicável, mapa com sete pontos, entrada concorrente na mesma batalha, liberação sequencial (Drak no quarto e Ravi Berserk no sexto), revisão/idempotência de turnos, derrota sem avanço e rotas protegidas.
- `npm run build`: aprovado; a tela de batalha é gerada em chunk separado (~17,5 kB) e o restante em chunk principal (~485 kB).
- Migração aplicada ao banco de desenvolvimento e reexecutada no banco exclusivo de testes.
- Smoke test HTTP do build de produção: frontend e asset JavaScript servidos, API desconhecida retorna 404, cadastro, cookie Secure, sessão, leitura de progresso e logout aprovados com PostgreSQL real.
- Verificação em navegador real (Edge) do mapa da campanha em 1920, 1366, 1024 e 390 px: sete pontos, somente o primeiro habilitado no início, painel lateral alinhado à direita em todas as resoluções, criação de equipe sem avisos e sem tooltip, vitória real em sete turnos liberando os pontos 2, 3 e 4 (Drak) e ausência de overflow ou erros de página.
- Layout da lista e da seleção de campanha validados em Edge em cinco tamanhos de tela, sem overflow horizontal.

O smoke de produção e os testes visuais anteriores seguem válidos. Nesta atualização, 87 testes sem banco externo, 18 com PostgreSQL real, tipos e build passaram. O seed foi aplicado ao banco de desenvolvimento; as migrations 001–005 estão registradas e reaplicáveis. Nenhuma imagem de personagem foi regenerada e nenhum serviço adicional da aplicação foi iniciado.

Ainda pendentes: loja demonstrativa (T35), áudio (T36), conclusão do caminho no combate 7 e habilidades próprias da transformação (T31), diálogos/desfechos guiados (T32), restantes da matriz de testes (T37), validação de ponta a ponta em navegador (T38), revisão de acessibilidade (T39) e consolidação final da documentação/publicação (T40).
