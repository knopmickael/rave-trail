# Decisões técnicas — Rave Trail

## 2026-10-29 — Base full-stack e identidade

### Decisão aprovada de produto

Substituir persistência offline em IndexedDB por PostgreSQL no servidor. Adicionar cadastro e login por e-mail/senha, sem confirmação por e-mail e sem provedores sociais. O MVP passa a requerer conexão ao backend; multiplayer continua fora do escopo.

### Implementação

- React, TypeScript e Vite no frontend; Fastify e TypeScript no backend.
- Um único pacote npm, sem monorepo: `src/`, `server/` e `shared/` mantêm limites claros com configuração mínima.
- `pg` com SQL parametrizado e migrações SQL explícitas; ORM não é necessário para o esquema inicial.
- Migrações transacionais com trava consultiva e registro em `schema_migrations`.
- Conta, progresso inicial e sessão criados na mesma transação.
- `player_progress.data` usa JSONB com `schemaVersion`; `revision` permite controle de concorrência ao implementar mutações. Identidade e sessões usam tabelas relacionais próprias.
- Senhas com `scrypt` do Node.js: N=32768, r=8, p=1, salt de 16 bytes e chave de 64 bytes. Evita dependência nativa adicional para hash de senha.
- Sessões opacas de sete dias. Token aleatório de 32 bytes no cookie; apenas SHA-256 do token no banco. Consulta ao banco verifica expiração e permite revogação imediata.
- Cookies `HttpOnly`, `SameSite=Lax`, sem `Domain`, `Secure` em produção; sem JWT em armazenamento JavaScript.
- Origem exata obrigatória em mutações e limite de tentativas por IP para login/cadastro. O Fastify não confia automaticamente em cabeçalhos de proxy para determinar IP.
- Frontend e API na mesma origem: proxy do Vite em desenvolvimento e arquivos de `dist/` servidos pelo Fastify em produção.
- Contratos compartilhados não dependem de React, PostgreSQL ou APIs do navegador.

### Dependências e ferramentas

Fastify fornece HTTP e validação de fluxo; seus plugins cuidam de cookies, limitação de tentativas e arquivos estáticos. Zod valida entradas. Vitest, Testing Library e jsdom verificam contratos HTTP e fluxos de formulário. `concurrently` inicia web e API; `tsx` executa TypeScript no desenvolvimento e nas migrações.

A versão do Vite é unificada por `overrides` para evitar resolução incompatível dos peers opcionais do Vitest pelo npm. As versões instaladas estão fixadas em `package-lock.json`.

### Limites da entrega inicial

Conta, autenticação, leitura de progresso e integração visual implementadas. Alteração de equipe, áudio, campanha, recompensas e combate serão serviços autenticados próprios. Não há endpoint genérico para salvar JSON enviado pelo cliente como progresso oficial.

O motor compartilhado permitirá simulação/previsão no cliente, mas o backend validará comandos e resolverá batalhas contra IA. Recompensas dependerão de resultados calculados no servidor. Isso não implica implementar partidas entre jogadores.

### Regras de combate consolidadas

- Regeneração de 15 por turno, inclusive extras; Reter energia continua +15.
- Ataque enfileirado contra alvo derrotado na própria sequência gera MISS e mantém custo e ação.
- Turnos extras acumuláveis, sem cooldown ou limite artificial.
- Demais decisões aprovadas estão incorporadas nas seções correspondentes de `product.md`.

### Propostas ainda não confirmadas

1. Aplicar a recuperação de Reter energia na barra prevista durante o planejamento, antes da confirmação.
2. Se remover ou reordenar ações tornar a fila energeticamente inválida, manter as ações, destacar o erro e bloquear a confirmação.

Esses detalhes devem ser confirmados antes da implementação do planejador de combos. As regras explícitas de consumo imediato na barra e remoção por novo clique já estão aprovadas.

## 2026-10-29 — Lista de personagens

- Layout e interação baseados no template fornecido em `assets/imgs/TEMPLATE-LISTA-DE-PERSONAGENS.png`.
- Catálogo estático compartilhado em `shared/content/`, com personagens narrativos separados das versões jogáveis, loadouts de quatro habilidades e IDs compatíveis com o progresso existente.
- Desbloqueios e equipe vêm exclusivamente do endpoint autenticado `/api/progress`. O frontend não cria progresso substituto quando a rede falha.
- A seleção da miniatura é estado de apresentação: não altera a equipe salva. O bloco “Minha equipe” é consulta nesta entrega.
- Unidades bloqueadas são botões desabilitados e esmaecidos; o tooltip mostra apenas o nome. Apenas desbloqueadas abrem o painel de detalhes.
- Artes vetoriais temporárias originais, com cortes de rosto e representação de corpo inteiro; identificadas na tela e substituíveis pelas artes definitivas. Nenhuma dependência gráfica adicional.
- O menu base disponibiliza a lista; demais funcionalidades permanecem identificadas até suas implementações.

## 2026-10-29 — Céu animado WebM

- Vídeo VP9 gerado a partir do céu existente, sem recursos de terceiros: 24 segundos, 24 fps, 1280×854 e sem áudio. Translação e deformação periódicas compartilham o período do loop.
- FFmpeg usado somente como ferramenta de autoria, instalado temporariamente fora do projeto. Nenhuma dependência adicional de runtime; geração reproduzível por `scripts/generate-sky.mjs`.
- `SkyBackground` é montado fora de `App`, uma única vez, para preservar o movimento nas trocas de tela. Vite publica o WebM como asset com nome versionado.
- Imagem original como poster/fallback; vídeo decorativo sem controles, inacessível ao foco e aos leitores de tela. Entrada visual suave apenas após começar a reprodução.
- Preferência de movimento reduzido impede a montagem do vídeo e é acompanhada em tempo real. Visibilidade da aba controla pausa/retomada; falhas deixam a imagem estática.

## 2026-10-29 — Tipografia moderna e seis unidades na lista

- Fontes sans-serif de sistema, priorizando Segoe UI Variable/Segoe UI, sem necessidade de baixar fontes externas. `--font-ui` centraliza a tipografia de todos os componentes.
- Paleta de ações laranja inspirada no logo, com variáveis compartilhadas para fundo, borda, texto, hover, pressed e foco. O cartão branco de perfil mantém sua apresentação aprovada.
- `ROSTER_UNIT_IDS` e `rosterUnits` definem explicitamente as seis unidades apresentadas na lista. O catálogo completo `units` mantém as definições de inimigos necessárias aos combates, sem alterar IDs ou progresso salvo.
- Miniaturas em grade 3×2. Sem seleção, não há painel ou mensagem no lado direito; selecionar uma unidade desbloqueada monta os detalhes normalmente.

## 2026-10-29 — Distribuição e contraste da lista

- Grade com áreas independentes para miniaturas, equipe e detalhes, ocupando a altura disponível. Em desktop, equipe alinhada ao canto inferior esquerdo e detalhes ao inferior direito, preservando os recuos compartilhados do menu.
- Coluna de habilidades/descrição pode rolar em telas de menor altura; ilustração e nome permanecem visíveis. Em telas estreitas, os blocos entram no fluxo vertical sem sobreposição ou rolagem horizontal.
- Painel próprio de habilidades com fundo sólido, assim como nome e descrição. A página continua transparente para o céu compartilhado.
- As miniaturas bloqueadas usam uma div preta sob o botão esmaecido, sem afetar o tooltip do nome ou habilitar cliques.
- Removidos os quatro textos auxiliares especificados pelo usuário. A identificação de artes provisórias permanece no painel da ilustração/detalhes.
- Layout e cores conferidos em Edge com sessão/progresso controlados no teste e capturas em quatro tamanhos de tela.

## 2026-10-29 — Catálogo PostgreSQL, equipe e apresentação atualizada

- Substitui a restrição anterior de consulta: todas as miniaturas abrem detalhes, inclusive bloqueadas. O bloqueio é apresentado no corpo inteiro esmaecido com cadeado e é validado no backend ao escalar.
- Nomes aprovados: Ravi de Berdal, Doko de Berdal, Anna de Berdal, Drak de Pontes, Ravi Berserk e Fera Lendária. IDs preservados.
- Catálogo normalizado em `narrative_characters`, `units`, `abilities` e `unit_abilities`; paths de imagens no banco e arquivos estáticos em `public/media/`. A interface lê `/api/catalog`, sem fallback de catálogo local.
- Migração `002_catalog_and_team.sql` e seed idempotente executados por `db:migrate`; `db:seed` reaplica apresentação sem sobrescrever efeitos/custos ou loadouts existentes.
- Equipe com três slots nuláveis em `player_team_slots`. Retirada a cópia de equipe do JSONB; `/api/progress` hidrata a equipe a partir dos slots. Equipe automática antiga vira vazia; equipes personalizadas são preservadas. Rerodar o seed não reinicializa slots já migrados.
- `PUT /api/team/slots/:slot` usa a conta da sessão. Transação e trava do progresso por usuário serializam alterações; restrição única evita duplicar uma unidade. Slot ocupado é substituído; mover a mesma unidade libera a posição anterior.
- Equipe vazia é válida na configuração, mas não no início de uma batalha. Modal de escolha mostra slots 1–3; API usa índices 0–2. Gravação pessimista: interface muda apenas após sucesso.
- Corpo inteiro em PNG com alpha, renderizado por `img` sobre container transparente. Os PNGs mockados e ícones JPEG foram rasterizados a partir das artes originais do protótipo usando Sharp apenas na autoria, sem dependência de runtime.
- Detalhes preenchem toda a altura disponível abaixo do cabeçalho. Rolagem interna nas habilidades e no texto mantém o botão de adicionar no rodapé da descrição. Removidos avisos de mock, versão e HP da área do nome; metadados de combate e conteúdo pendente permanecem no banco.

## 2026-10-29 — Inimigos posteriores a Drak

- Cadastrados `guerreiros-habilidosos-a/b/c` como três identidades/unidades e `rival-b-final-mode` como nova versão do indivíduo narrativo `rival-b`, preservando a unidade original.
- Conjuntos temporários com Golpe simples, Guarda, Reter energia e Golpe forte, todos com `provisional=true`. Nenhum poder novo ou composição de encontro foi definido implicitamente.
- O vilão final da história é o rival B em sua forma final. As composições dos encontros posteriores e seus poderes específicos continuam pendentes.
- Seed reaplicado no PostgreSQL; cada novo inimigo tem quatro vínculos ordenados de habilidade e caminhos próprios de retrato/corpo inteiro.
- Geração de mock agora aceita IDs para gerar apenas as imagens novas, preservando os arquivos já existentes. Forma final usa paleta temporária distinta mantendo a identidade do rival.

## 2026-10-29 — Seleção de campanha

- Página inicial de seleção baseada nos templates de personagens e de campanhas fornecidos. Cabeçalho consistente, cenário próprio e cards verticais em faixa horizontal.
- Migração 003 cria `campaigns`; seed inicial contém somente `path-1` e `path-2`. Os demais caminhos narrativos permanecem planejados para cadastro futuro.
- `/api/campaigns` consulta todos os registros ordenados, com disponibilidade derivada de `released` e do progresso da conta. O seed não remove capítulos adicionais nem sobrescreve publicação/progresso.
- Card disponível usa imagem colorida a 0,6 de opacidade e escala 1,15 no hover/foco, com opacidade 1. Bloqueado usa imagem em grayscale, escurecida sobre preto, botão desabilitado e nenhum efeito de hover.
- Número laranja e título branco com contorno preto, separados dos arquivos de imagem. Imagens WebP temporárias derivadas do cenário original existente; geração com Sharp somente como ferramenta de autoria.
- Setas, teclado e gesto horizontal controlam a faixa. `ResizeObserver` e eventos de scroll atualizam os limites; a quantidade de capítulos não está fixada no componente. Redução de movimento remove escala/transições e rolagem suave.
- Clique marca seleção local do capítulo disponível. Integração com encontros/batalhas pertence à tarefa T28.
- Verificação em Edge com dados de PostgreSQL real no banco de testes: escala, opacidade, cores, bloqueio e expansão de dois para seis cards em quatro resoluções. Registros temporários e conta de teste removidos ao finalizar.

## 2026-10-29 — Catálogo completo, centro da tela e céu compartilhado

- Substitui o limite visual de seis unidades: a lista usa todos os registros de `/api/catalog`, inclusive com `roster_order` nulo. Esse campo serve à ordenação, não à disponibilidade. Desbloqueios continuam exclusivamente no progresso da conta.
- Cinco miniaturas por linha com gap de 6 px em desktop e 4 px em telas menores. A região de miniaturas pode rolar internamente quando necessário.
- Grade com colunas laterais simétricas e largura central compartilhada entre grade/painel: imagem e nome ficam exatamente em 50% da tela. A coluna de habilidades/descrição se ancora à margem direita, sem sobrepor o centro; equipe no canto inferior esquerdo.
- Migração 004 registra `rival-b-final-mode` como Premium junto da Fera Lendária, sem alterar equipes ou desbloqueios já concedidos. Novas contas têm somente os três protagonistas iniciais liberados.
- Seleção de campanha passa a usar o mesmo céu de menu/lista, sem cenário ou overlay próprios. As imagens internas dos cards continuam independentes. O gerador de capas não gera mais um cenário exclusivo para essa página.
- Verificação de coordenadas e bloqueios em cinco tamanhos de tela, incluindo o breakpoint de 901 px; teste de UI cobre registro adicional do banco sem ordem definida.

## 2026-10-29 — Nomes e ordem definitivos do catálogo atual

- Rivais renomeados para Jung, Exal e Monnica de Grimória; suportes para Curandeiro/Curandeira de Pontes; guerreiros para Trinity, Vlade e Passago de Espinea. `rival-b-final-mode` passa a Exal - Verdadeiro poder.
- Ordem: protagonistas, saqueadores, trio de Grimória, curandeiros, Drak, trio de Espinea, Ravi Berserk, Exal - Verdadeiro poder e Fera Lendária.
- Alteração de apresentação mantém os mesmos IDs narrativos/jogáveis e caminhos de imagem. Nenhuma imagem é regenerada.
- `roster_order` é único: o seed libera as posições apenas dos IDs que gerencia e reaplica a ordem na mesma transação, evitando colisões nas trocas e sem expor estado intermediário aos leitores.
- Regressão em PostgreSQL simula uma ordem antiga invertida, reaplica o seed e verifica nomes/posições, equipe, desbloqueios, habilidades e as duas unidades Premium.

## 2026-10-29 — Mapa da campanha e progressão sequencial

- O capítulo 1 da seleção abre `CampaignMap` (`src/features/campaigns/CampaignMap.tsx`). A arte `assets/imgs/mapa-campanha-01.png` vive em uma área de rolagem própria: a página inteira não gera overflow horizontal em nenhuma resolução.
- Os sete pontos são posicionados por `mapX`/`mapY` percentuais vindos de `shared/content/encounters.ts`; a página renderiza o que o servidor devolver, sem contagem fixa de combates.
- Painel lateral em `<dialog>` alinhado à direita, com "Batalha n", título, retratos dos adversários lidos do catálogo, texto de história, aviso de encontro provisório, "Iniciar batalha"/"Retomar batalha" e atalho "Montar equipe". Fecha por Escape, "×" ou clique fora; durante o envio o fechamento é bloqueado.
- Disponibilidade é calculada no servidor: um encontro só fica disponível quando todos os anteriores constam em `completedEncounters`. O cliente apenas apresenta o estado; tentativa de pular encontro retorna 403.
- Ordem aprovada do caminho 1: 1 Saqueadores da estrada → 2 A rota interrompida (provisório, reutiliza os saqueadores) → 3 Os Grimorianos → 4 Drak de Pontes (Guardião da passagem, recompensa `passage-guardian-base`) → 5 Os guerreiros de Espinea → 6 O despertar de Ravi (recompensa `protagonist-main-transformed`) → 7 Exal — Verdadeiro poder. Os encontros 2, 5, 6 e 7 são provisórios e exibem o aviso correspondente.
- Mudança de regra: o chefão Drak passou a ser liberado pelo combate 4, dependentemente do combate 3, alinhando conteúdo narrativo e sequência de desbloqueio; rewards e critérios de aceite em `product.md` foram atualizados.
- Migração `005_encounters_and_battles.sql` cria `encounters`, `encounter_enemies`, `encounter_rewards`, `battles` e `battle_commands`.
- Verificação: cinco testes de UI do mapa (sete pontos, gaveta, equipe vazia, Drak após três vitórias, erro/sessão), seis testes de banco específicos de mapa/batalha (18 no total) e execução real em Edge em 1920, 1366, 1024 e 390 px, sem overflow nem erros de página.

## 2026-10-29 — Motor de combate e batalha autoritativa

- `shared/core/battle.ts` concentra funções puras de criação, prévia de fila, resolução do turno do jogador e planificação/resolução da IA. O mesmo arquivo alimenta a prévia no navegador e a resolução oficial no servidor, sem depender de React, HTTP ou SQL.
- Regras aprovadas implementadas: jogador inicia com HP cheio e energia 0 (+15 no início do turno), teto de 100, débito imediato já na fila de planejamento, remoção por novo clique com recálculo, MISS com custo integral quando o alvo cai na própria sequência, turnos extras acumuláveis sem cooldown e Guarda em −10 por golpe sem acúmulo.
- Batalhas ficam em PostgreSQL com snapshot da equipe escalada no momento do início, `revision` por turno e `commandId` por ação. Reenvio e início concorrente retomam a mesma batalha e não executam o turno duas vezes.
- A vitória grava as recompensas de forma idempotente e desbloqueia o próximo encontro na mesma transação; a derrota não avança a campanha e uma nova tentativa reinicia HP/energia.
- Rotas: `GET /api/campaigns/:id/map`, `POST /api/encounters/:id/battles`, `GET /api/battles/:id` e `POST /api/battles/:id/turns`; o cliente envia comandos, nunca resultados.
- A tela de batalha é carregada sob demanda em chunk separado (lazy com `Suspense`), mantendo o chunk principal enxuto.
- Q01 e Q02 (recuperação de Reter energia na barra e sinalização de fila inviável) continuam pendentes de confirmação e não foram tratadas como regras aprovadas.

## 2026-10-29 — Sem avisos de equipe nem tooltip na lista

- A gravação de equipe não emite mensagens de sucesso, avisos ou toasts: a lista já reflete o estado devolvido pela API e apenas falhas produzem feedback recuperável.
- As miniaturas da Lista de personagens não apresentam tooltip ao passar o mouse; o nome permanece visível no painel de detalhes. O único `title` nativo é o da condição de desbloqueio em botões desabilitados.
- Regras registradas em `product.md` (seção 22) e verificadas por teste de UI (busca por `role=tooltip` ausente) e por checagem automatizada em navegador (zero `.team-notice`, zero `.face-tooltip`).

## 2026-10-30 — Hub e regras de desbloqueio (Tarefa 11)

- O hub é acessado por **Desbloquear personagens** e consulta `GET /api/character-unlocks`. Mostra treze personagens com metas e dois Premium a US$ 9,90. A aquisição fica desabilitada; a liberação por metas é automática e não gera notificações.
- `shared/content/unlocks.ts` concentra os requisitos; `shared/core/unlocks.ts` calcula o progresso. Jung exige Ravi de Berdal base. As condições de alguém de Berdal aceitam os três protagonistas e Ravi Berserk. A transformação exige suas três metas ao mesmo tempo. O modo da vitória é parte da condição, portanto vitórias rápidas contra Exal não cumprem a meta Multiplayer dele.
- A equipe que participa é o snapshot da batalha, independentemente de sobrevivência ou edição posterior dos slots. Cada batalha vencida conta uma vez por adversário; derrotas, partidas ativas e vitórias da campanha não contam.
- A migração 011 adiciona `battles.mode`, classifica o histórico existente e indexa vitórias elegíveis. O cliente não envia nem altera modo, resultado ou contagem. Desbloqueios são sincronizados na transação do resultado oficial, sob bloqueio de `player_progress`. O histórico é a fonte da contagem, evitando contadores duplicados por reenvio.
- O seed sincroniza vitórias históricas e as descrições de desbloqueio no catálogo. As regras desta tarefa substituem as antigas recompensas de Drak no encontro 4 e Ravi Berserk no encontro 6; concessões já persistidas são preservadas.
- O hub usa leitura consistente para metas e disponibilidade, atualiza ao recuperar o foco e oferece acesso à Lista de personagens. A lista lê a disponibilidade do servidor e usa somente **Adquirir personagem** desabilitado para Premium bloqueados.

## 2026-10-30 — Atualização de Drak e metas de Espinea (Tarefa 12)

- Drak de Pontes troca Guarda por Proteção coletiva. A migração `012_drak_collective_guard.sql` atualiza o catálogo persistido; a definição compartilhada também usa a nova habilidade.
- Trinity e Vlade passam a exigir 20 vitórias rápidas contra Grimorianos. Passago exige simultaneamente 20 rápidas e 10 Multiplayer contra o mesmo grupo, sem a antiga exigência de alguém de Berdal.
- Grimorianos, nessas metas, correspondem às unidades base de Jung, Exal e Monnica. Uma batalha vencida com pelo menos um deles conta uma vez; múltiplos integrantes na equipe inimiga não multiplicam o progresso. Os modos são separados.
- Requisitos agora aceitam um conjunto de adversários. O hub e as descrições da Lista de personagens usam as definições atualizadas; o seed reaproveita o histórico e sincroniza a disponibilidade na conta.

## 2026-10-30 — Protagonistas na Batalha rápida e ajuste de Ravi (Tarefa 13)

- A consulta de adversários inclui os três protagonistas independentemente da campanha. As equipes continuam sendo sorteadas no servidor, sem repetir unidades; os demais adversários dependem dos encontros já vencidos.
- Ravi Berserk exige 50 vitórias rápidas no total além das três metas existentes de Grimória. A condição total conta qualquer adversário, uma vez por partida, somente no modo rápido. O seed aplica a nova meta ao histórico persistido.
- A migração 013 troca Proteção coletiva por Guarda em Ravi Berserk. Novas batalhas usam o catálogo atualizado.

## 2026-10-30 — Composição da tela de batalha, registro e desistência (Tarefa 04)

- A interface foi reorganizada conforme o template: botão Encerrar turno no topo central, energia acima de cada trio, retratos/HP em coluna e habilidades à direita. Em dispositivos estreitos, os trios são empilhados para manter legibilidade e impedir overflow horizontal.
- Uma escolha bloqueia as demais habilidades do mesmo personagem. A energia de habilidades com alvo individual é reservada no clique, antes da escolha de alvo; o cancelamento devolve a reserva. A fila oficial continua sendo revalidada pelo motor compartilhado e pelo backend.
- O registro deixa de ser um painel limitado a 80 eventos. O botão fixo no canto superior direito abre um dialog nativo de tela inteira; `battles.log` armazena todos os eventos. A migração 014 recupera o histórico dos comandos antigos por revisão e posição do evento.
- Desistir só navega após a confirmação do servidor. O estado `abandoned` é idempotente, definitivo e não concede vitórias ou recompensas. Turno, desistência e novos inícios usam o bloqueio de progresso da conta para serializar operações concorrentes.
- Os botões de retorno e retomada foram removidos das batalhas ativas e do mapa. Um novo início encerra tentativas antigas ainda abertas e cria uma batalha com HP, energia e fila iniciais. Após vitória ou derrota, o retorno ao mapa ou ao modo rápido continua disponível.
- Validação em Edge headless nas larguras 1366, 1920 e 390: botão centralizado, habilidades à direita, HP abaixo das imagens, ausência de overflow horizontal, energia imediata, turno resolvido, registro fullscreen e desistência com retorno à página correta.

## 2026-10-30 — Cartões, ícones e temporização (Tarefa 14)

- `fighter-abilities` passa a conter o retrato, HP, nome, efeitos ativos e habilidades dentro do mesmo fundo de papiro. A arena usa a largura disponível e não exibe VS. Os efeitos de Guarda registram a habilidade de origem para mostrar o ícone correto de Guarda ou Proteção coletiva, com limpeza na expiração e ressurreição.
- Habilidades são ícones sem rótulos visíveis nem `title` nativo. Um tooltip controlado abre após 1000 ms de hover/foco, incluindo habilidades desabilitadas, e é cancelado no clique, saída, Escape, mudança de seleção ou rolagem. O clique suprime a reabertura até uma nova entrada no ícone.
- O combo mostra somente retrato, habilidade e remoção. Foram retirados o painel permanente de detalhes e as setas de reordenação; a ordem continua sendo a de seleção das ações.
- A resolução autoritativa passa a processar um lado por vez. Cada turno recebe 45 segundos e, nos modos com IA, cada turno do bot recebe uma espera de 7 segundos. Turnos extras recebem novos prazos e pausas. O timeout do jogador encerra sem executar escolhas que não foram enviadas ao servidor.
- A migração 015 persiste os relógios. Uma rotina de segundo em segundo, consultas de estado e submissões resolvem prazos vencidos sob o bloqueio de progresso/batalha; consultas concorrentes não duplicam ações. O modo Multiplayer usa os mesmos prazos, sem acionar IA. A rotina é encerrada antes de fechar o pool SQL.
- O cliente consulta revisões oficiais, preserva a seleção em consultas sem mudanças, bloqueia o planejamento durante o turno adversário e sincroniza ao recuperar foco/visibilidade. A contagem visual não concede ao cliente autoridade para alterar os prazos.
- Verificação real em Edge em 1366, 1920 e 390 px: cartões unificados sem overflow horizontal, ícones sem rótulos, tooltip atrasado e fechado no clique, combo visual, efeitos acima das habilidades, pausa de bot de aproximadamente 7,1 s e encerramento automático de um turno ocioso de 45 s.

## 2026-10-30 — Nova lista de tarefas 01–04: áudio, perfil e duelo final

- A versão atual de `todo-list.md` substitui a lista anterior: foram entregues as tarefas 01–04. A tarefa 05 de reorganização da arquitetura foi explicitamente excluída pelo usuário.
- As batalhas 1–6 mantêm a clareira e `fight.ogg`. Somente `path-1-encounter-7` usa os assets fornecidos `evil-fight-background.png` e `final-fight.mp3`. O áudio global alterna as três faixas (menu, batalha e final), em loop, com um único controle de volume/silêncio.
- Um listener de clique em captura cobre os botões de todas as telas, inclusive diálogos e ativação por teclado. Usa `click-menu.wav` fora da arena e `click-battle.wav` dentro dela, ignorando botões desabilitados. `change-turn.wav` e `player-death.wav` são disparados por atualizações oficiais da batalha, sem efeitos nas prévias ou repetição ao ler o histórico.
- Cadastro e login passam a emitir sessões de 3.600 segundos. A migração 017 limita as sessões antigas a `created_at + 1 hora` e adiciona `users.name`, inicialmente `Aventureiro`. `PATCH /api/profile` valida e salva somente o nome da conta autenticada (1–40 caracteres); não renova a sessão. As respostas de autenticação e perfil incluem o prazo absoluto, usado pelo cliente para pedir novo login inclusive em telas ociosas e ao recuperar foco/visibilidade.
- A migração 018 e o seed sincronizam as formações ordenadas: saqueadores → trio de Grimória → Drak e curandeiros → trio de Espinea → trio de Grimória → Jung e Exal → Exal final. O seed remove slots excedentes de forma transacional, sem modificar snapshots de batalhas já criadas. O ponto 6 fica em 74,5% / 33%, na fronteira com as trevas.
- O painel final exibe a frase de requisito literalmente abaixo da história. Frontend e backend exigem Ravi base na equipe. O servidor inicia apenas Ravi contra Exal final, mesmo que os três slots estejam preenchidos; Ravi Berserk desbloqueado não substitui o requisito de Ravi base.
- Decisão de implementação para o gatilho não especificado: no início do segundo turno de Ravi, após a primeira rodada adversária, a unidade é substituída por Berserk no mesmo identificador de combatente. Mantém HP proporcional, energia e efeitos ativos; recebe retrato e habilidades da versão transformada. A configuração vem do snapshot do catálogo e é consumida uma única vez pelo motor puro. O evento `transform` é persistido e anunciado na arena/registro. Essa substituição é exclusiva da partida, sem alterar equipe salva ou conceder desbloqueio permanente.
- Verificação: 200 testes gerais, 54 de PostgreSQL real, `npm run typecheck` e `npm run build` aprovados. Migrações 017–018 aplicadas ao banco local. Jornada em Edge headless verificou sessão, edição/reabertura do nome, equipes 6–7, requisito, cenário/música final, transformação solo, vitória, os quatro efeitos sonoros, retorno à trilha comum e ausência de overflow horizontal em 1366 e 390 px. Conta temporária de verificação removida ao final.

## 2026-10-31 — Missões atualizadas e separação da arquitetura

- A nova versão do `todo-list.md` autoriza as duas tarefas, incluindo a reorganização antes excluída. O botão de requisitos e o contador-resumo foram removidos; cada cartão contém sua lista completa, com rolagem vertical interna. O carrossel preserva duas linhas e cartões uniformes; as setas desaparecem nas respectivas bordas.
- Todas as quinze missões são retornadas pela API. `campaignAvailable` identifica as habilitadas pelos adversários dos encontros vencidos. As demais ficam inertes, escurecidas sobre fundo preto e com cadeado; seus contadores retornam zero e o sincronizador não concede esses desbloqueios. A mudança não concede ao cliente autoridade sobre disponibilidade ou progresso.
- A correção anterior de progresso por missão continua persistida em `missionProgressResets`; os registros oficiais de partidas foram preservados e o seed não desfaz os marcos. O nome original da migração 019 foi mantido ao mover o SQL.
- As fontes foram separadas em `frontend/src`, `backend/src` e `shared/src`, usando `@game/*` para dependências compartilhadas. Shared possui checagem sem DOM/Node, e backend sem DOM. O frontend não importa código da API, nem o inverso.
- Toda mídia de runtime foi consolidada em `frontend/public/media`. Templates foram para `docs/design/templates`, documentação de mídia para `docs/assets`, geradores para `tools/assets` e o protótipo para `archive/prototype`. Os caminhos de mídia do catálogo persistido foram mantidos; imagens gerais, áudio e vídeo agora usam `/media/`.
- Vite gera `frontend/dist`; esbuild gera a API ESM em `backend/dist/index.js`, incorporando o código compartilhado e mantendo dependências Node externas. `backend/src/paths.ts` resolve `.env`, publicação da SPA e migrações em desenvolvimento/build. `npm run clean` remove saídas geradas. O `.env` permanece na raiz e não é parte da publicação.
- Três testes de arquitetura analisam imports pelo TypeScript, conferem as fronteiras e verificam os caminhos de mídia e a separação dos diretórios. `tools/smoke-production.mjs` inicia o executável compilado com banco exclusivo de testes e verifica SPA, mídias com Range, autenticação, perfil, missões, equipe e um turno oficial.
- Verificação: 219 testes gerais, 57 com PostgreSQL, tipos por camada, build e smoke de produção aprovados. O ambiente de desenvolvimento foi iniciado com os novos comandos. Edge conferiu missões habilitadas/bloqueadas, listas verticais e setas em quatro resoluções, o mapa animado e ambos os cenários de batalha a 30 fps nos novos caminhos. Contas temporárias de verificação foram removidas.

## 2026-10-31 — BOT com busca exata de dano por combo

- `planEnemyTurn` passa a explorar as combinações legais do turno, incluindo ordem das ações, escolha de alvos, habilidades de recuperação de energia e encerramento em qualquer prefixo. O mesmo planejador puro e determinístico continua sendo usado na campanha e nas batalhas rápidas, sem LLM ou serviço externo.
- O dano é o HP efetivamente removido de todos os adversários, descontando Guarda e sobre-dano. A comparação é lexicográfica: maior dano, mais eliminações, menos ações para uma vitória já possível e, em empate, ressurreição, turnos extras, HP recuperado, Guarda, energia restante e economia de ações. Suporte não pode superar um combo com dano maior.
- Cada prefixo usa `previewActions` contra o snapshot inicial. A busca não permite agir com um aliado ressuscitado no próprio turno e interrompe a expansão após o resultado. Cada turno extra recebe um novo planejamento.
- Memoização elimina apenas prefixos com o mesmo estado e os mesmos atores já usados; não há amostragem ou limite artificial que descarte combinações. Empates completos respeitam a ordem estável dos slots, habilidades e alvos.
- Uma referência independente, baseada em atribuição de ações e permutações, confirmou o máximo em 20 cenários. Testes dirigidos incluem retenções intermediárias, vários golpes baratos superiores a um forte, Guarda, alvos de pouco HP, eliminações, suporte sem perda de dano, imutabilidade e fim da batalha. A integração verifica o combo persistido, sua resolução oficial e a concorrência.
- Medição local de 340 planejamentos em 17 cenários: média 2,474 ms, p95 14,819 ms e máximo 16,712 ms. A suíte final passou com 234 testes gerais e 57 testes PostgreSQL; tipos e build aprovados. O teste de arquitetura deixou de exigir o diretório histórico opcional `archive/prototype`, ausente no workspace, mantendo as verificações das camadas ativas.

## 2026-10-31 — Jung de Grimória II e nomes reais dos assets

- `jung-de-grimoria-ii` é uma nova unidade da identidade narrativa `rival-a`, exibida ao lado do Jung original no catálogo. Tem 100 HP e o mesmo conjunto inicial: Golpe simples, Guarda, Reter energia e Investida. As artes fornecidas foram preservadas.
- Na batalha 6, o slot inicial passa a usar Jung II; o segundo continua sendo Exal de Grimória. A formação dos demais encontros e os IDs dos snapshots históricos continuam representando os participantes originais.
- Regra confirmada pelo usuário: vencer a batalha 6 habilita Jung II no sorteio rápido; a missão exige 25 vitórias rápidas contra Jung II com Ravi de Berdal base na equipe. A unidade tem contador independente. As metas gerais de Grimorianos reconhecem Jung I e II; as missões individuais continuam específicas de cada versão.
- A migração 020 cria a unidade a partir do Jung original e copia suas habilidades, com suporte a banco vazio via seed. O seed reaplicável mantém a ordem do catálogo e a formação atualizada.
- As imagens de todas as unidades agora usam nomes reais em minúsculas, sem acentos, com sufixos `-face.png` e `-body.png`. Os 38 PNGs foram renomeados com preservação de SHA-256. Os IDs de unidades, equipe e progresso não foram renomeados.
- A migração 021 substitui valores de caminhos antigos no catálogo e nos JSONs de batalhas e respostas de comandos, incluindo a transformação de Ravi. Preserva valores de combate, revisões, resultado, prazos e datas das vitórias. Os testes verificam também a reaplicação e o replay idempotente dos comandos.
- Validação: 239 testes gerais, 61 com PostgreSQL, tipos e build aprovados. Migrações 020–021 aplicadas ao banco local; auditoria encontrou zero referências legadas em batalhas/respostas. As 38 imagens foram servidas pelo build via injeção HTTP e comparadas aos hashes originais, com catálogo de 19 unidades e missão de Jung II com meta 25.
