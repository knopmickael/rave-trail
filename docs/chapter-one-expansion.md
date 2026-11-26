# Expansão da campanha 01 — migrations 046 e 047

## Habilidades

| Habilidade | Energia | Regra atual |
|---|---:|---|
| Execução | 50 | 50 de dano imediato a um inimigo, respeitando Guarda e Invulnerabilidade. |
| Benção divina | 40 | Protege um aliado vivo, inclusive o usuário, contra um dano fatal. O aliado fica com 1 HP e a benção é consumida. |
| Corte rápido | 30 | 20 de dano imediato e 5 de sangramento nos três próximos turnos da equipe alvo. |
| Trazer dos mortos | 50 | Revive um aliado com o HP máximo e limpa efeitos anteriores. |
| Recuperar muita vida | 50 | Restaura 30 HP de cada aliado vivo, até o HP máximo. |
| Turno extra | 40 | Concede um turno adicional à equipe após encerrar o turno atual. |

Benção divina não acumula cargas, não expira antes de ser consumida e pode impedir dano fatal direto, drenagem ou sangramento. Não é Guarda ou Invulnerabilidade, portanto Retaliação não a remove. Uma nova aplicação após o consumo concede uma nova proteção. O BOT e a prévia usam exatamente a regra oficial do servidor. Drenagem recupera somente o HP efetivamente perdido pelo alvo, inclusive quando a benção impede sua morte.

Drak passa a usar Golpe simples, Guarda, Reter muita energia e Turno extra. Trinity troca Varredura tática por Benção divina. Jung II usa Retaliação, Invulnerabilidade, Reter muita energia e Execução.

A migration **049** atualiza os custos de Execução e Recuperar muita vida para 50 de energia. Na batalha, habilidades aliadas e inimigas usam cursor de interação, inclusive ao consultar opções desabilitadas; os tooltips aparecem após **250 ms** com mouse ou foco de teclado.

## Personagens e encontros

Os novos personagens têm 100 HP e usam os arquivos de corpo/rosto fornecidos em `frontend/public/media/characters/`:

| ID estável | Nome | Habilidades |
|---|---|---|
| `saqueador-da-estrada-iii` | Saqueador da estrada III | Golpe simples II, Guarda, Reter muita energia, Proteção coletiva |
| `saqueador-da-estrada-iv` | Saqueador da estrada IV | Golpe simples II, Guarda, Reter energia, Corte rápido |
| `saqueadora-da-estrada-ii` | Saqueadora da estrada II | Golpe simples II, Guarda, Reter energia, Corte rápido |
| `exal-de-grimoria-ii` | Exal de Grimória II | Drenar alma, Guarda, Reter muita energia, Vórtex negro |
| `monnica-de-grimoria-ii` | Monnica de Grimória II | Recuperar vida, Guarda, Reter muita energia, Recuperar muita vida |

Os IDs dos sete encontros são preservados. As batalhas 1–3 e 7 conservam suas equipes. A batalha 4 passa a enfrentar os três novos saqueadores; a 5 enfrenta Trinity, Vlade e Passago; a 6 enfrenta Jung II, Exal II e Monnica II. Títulos e histórias acompanham os novos confrontos; mapa, posições e coordenadas existentes são preservados.

### Ordem do catálogo — migration 048

A Lista de personagens e o Quadro de missões usam a mesma ordenação persistida em `roster_order`. A migration `048_campaign_roster_order.sql` estabelece esta sequência inicial:

Ravi, Doko, Anna, Kalis, Ridan, Saqueador I, Saqueador II, Saqueadora I, Jung I, Exal I, Monnica I, Curandeiro, Curandeira, Drak, Saqueador III, Saqueador IV, Saqueadora II, Trinity, Vlade, Passago, Jung II, Exal II, Monnica II, Ravi Berserk, Exal — Verdadeiro poder, Besta Lendária.

As missões pertinentes mantêm essa ordem, respeitando os filtros existentes de personagens iniciais e Premium. Conteúdo da campanha 02 e personagens adicionais vêm depois, preservando sua ordem relativa no banco. O seed usa a mesma ordem para novos bancos e continua preservando ajustes posteriores pelo CMS.

As ilustrações de corpo na seleção são centralizadas e dimensionadas pela altura disponível, mantendo a proporção e a largura automática. Artes mais largas podem transbordar horizontalmente pelo espaço ao redor, sem recorte pelo quadro. Catálogo, equipe e painel de informações ficam à frente da arte; a imagem decorativa não intercepta cliques. Miniaturas e ícones continuam com seus próprios enquadramentos.

## Missões

| Personagem | Revelação | Requisitos de Batalha rápida |
|---|---|---|
| Novos três saqueadores | Batalha 4 | 15 vitórias; derrotar o próprio personagem 10 vezes |
| Trinity, Vlade e Passago | Batalha 5 | 20 vitórias; derrotar o próprio personagem 15 vezes |
| Exal II e Monnica II | Batalha 6 | 25 vitórias; derrotar a própria versão II 20 vezes |
| Jung II | Batalha 6 | 25 vitórias; derrotar Jung II 20 vezes; derrotar Jung II 10 vezes usando Ravi de Berdal base |
| Ravi Berserk | Batalha 7 | 30 vitórias; derrotar Jung II 20 vezes usando Ravi base; derrotar Exal II 20 vezes usando Ravi base |

As novas listas substituem as metas anteriores das unidades indicadas. A revelação é uma configuração própria, não uma meta adicional no cartão. Vitórias anteriores à revelação continuam seguindo os marcos já registrados pelo jogo. IDs das versões originais não contam como versões II. Personagens já conquistados não são revogados.

## Bloqueio por desistências

- A décima desistência de Batalha rápida em uma janela móvel **menor que cinco minutos** bloqueia novos inícios de rápidas durante cinco minutos, contados a partir dessa desistência.
- Repetir a requisição de desistência da mesma partida não conta novamente. Fechar uma rápida ativa ao começar outra rápida ou uma campanha também conta.
- Desistências de campanha e multiplayer não contam. O bloqueio não impede jogar campanha ou multiplayer.
- O servidor mantém o lock de progresso da conta ao encerrar a partida e atualizar o limite, incluindo requisições concorrentes. A décima desistência implícita é confirmada antes de rejeitar o novo início.
- Até nove timestamps recentes e um prazo de bloqueio são persistidos em colunas próprias de `player_progress`; o JSON de progresso não é alterado. A lista é limpa ao disparar o bloqueio. Não é necessário consultar ou reter snapshots de partidas para aplicar a regra.
- `/api/quick-battle` devolve `blockedUntil` e `serverTime`. Um início bloqueado responde **429**, com mensagem, `retryAt` e `serverTime`.
- A interface usa o relógio do servidor, desabilita **Entrar na batalha**, mostra o contador ao lado e revalida a disponibilidade ao abrir a tela/recuperar o foco. Uma resposta antiga não pode apagar um bloqueio recém-retornado pelo servidor.

## Ajustes de entardecer e adversários

- Kalis e Ridan estão entre os adversários iniciais da Batalha rápida (`QUICK_BATTLE_ALWAYS_UNIT_IDS`), sem filtro de posse na lista de Adversários; a aquisição jogável continua pelas missões do Quadro de missões.
- Exal - Verdadeiro poder tem 200 HP de atual/máximo somente como inimigo em `path-1-encounter-7` (`FINAL_EXAL_BOSS_HP`), aplicado na criação da batalha final. Catálogo, jogador, rápidas, multiplayer e snapshots existentes continuam com 100 HP.
- Ao concluir a campanha 1 (batalha 7 vencida, segundo `completedEncounters` salvo), os menus aplicam o filtro de `menu-background-filter.html` ao mesmo `menu-background-default.mp4`, sempre em 0.5×. O poster de 00:01 aparece durante o download completo e com movimento reduzido, recebendo o mesmo filtro. A camada é decorativa, não intercepta cliques nem filtra os controles; logout e troca de conta não herdam o tema. Detalhes em `docs/assets/video.md`.
- Na preparação da Batalha rápida, somente a grade de ícones de Adversários é rolável (`overflow-y:auto`, focável por teclado); explicação, contador, cooldown e **Entrar na batalha** permanecem visíveis, inclusive em viewports baixos e com cooldown ativo.

## Atualização dos bancos

- `046_chapter_one_expansion.sql`: habilidades, conjuntos, personagens, formações e missões. Preserva conteúdo não solicitado do CMS e os snapshots existentes.
- `047_quick_battle_surrender_limit.sql`: colunas operacionais do limitador, inicialmente vazias. Não penaliza desistências anteriores à atualização.
- O fluxo de produção existente aplica migrations e seed. O seed reserva posições ocupadas pelo CMS e encontra posições livres para o catálogo, evitando conflitos ao adicionar personagens.
- O backend/frontend e as migrations devem ser publicados juntos. Partidas iniciadas antes da atualização conservam seus próprios custos, efeitos e equipes.

Validação: testes do motor, contratos CMS, integração PostgreSQL em schema isolado, preservação de snapshots e autoria, limite concorrente/idempotente e contador da interface.
