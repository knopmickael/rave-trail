# Multiplayer por WebSocket: plano de implementação

**Status:** planejamento; a funcionalidade ainda não foi implementada.

Este documento registra as regras confirmadas para a primeira entrega e a proposta técnica discutida para o Rave Trail. As etapas e verificações estão em [tarefas de multiplayer](multiplayer-tasks.md). Não substitui regras já implementadas da campanha e da Batalha rápida.

## 1. Objetivo e escopo

Habilitar partidas entre dois jogadores com fila global e sincronização da montagem do combo quase em tempo real. Usar `@fastify/websocket` no processo Fastify existente, mantendo Caddy, PostgreSQL e a instância Lightsail atuais.

Não são necessárias salas, convites, filtros de região, classificação por habilidade, SQS, API Gateway ou uma nova instância nesta primeira entrega. A interface de ranking é uma evolução posterior, alimentada pelos resultados compactos das partidas.

## 2. Regras confirmadas

| Comportamento | Regra |
|---|---|
| Busca | Fila global por ordem de chegada; emparelhar os primeiros dois jogadores disponíveis, sem filtro de região |
| Equipe | Exatamente três personagens válidos, habilitados e desbloqueados, sem repetir a mesma unidade |
| Início | Servidor sorteia quem começa |
| Turno | 45 segundos, controlados pelo servidor |
| Prazo esgotado | Descartar o combo em preparação e passar sem executar ações |
| Combo | Sincronizar cada adição e remoção válida com o adversário |
| Desistir | Derrota imediata de quem desistiu e vitória do adversário |
| Desconexão | Tolerância de 10 segundos para reconectar; depois, derrota por abandono |
| Histórico | Disponível temporariamente para a função Histórico de batalha; sem retenção permanente de todas as ações |
| Resultado | Persistir vencedor, perdedor, data, equipes e total de rodadas; preparar dados para futuro ranking |

Fechar o navegador, recarregar a página e perder a rede não são distinguíveis com certeza pelo servidor. A tolerância de 10 segundos vale para essas situações. Trocar de aba ou minimizar o navegador, por si só, não caracteriza desistência.

## 3. Propostas complementares a validar

Estas definições completam casos não decididos explicitamente pelo usuário; devem ser confirmadas antes da implementação correspondente:

- Exigir confirmação de carregamento dos dois clientes antes de iniciar a partida e o relógio. Definir prazo limitado de preparação; jogador disponível retorna à fila se o adversário não confirmar.
- Se ambos estiverem desconectados quando o abandono for processado, anular sem conceder vitória, derrota ou progresso. Se apenas um estiver desconectado e sua tolerância expirar, aplicar abandono normalmente.
- Partidas interrompidas por falha/reinício do servidor sem recuperação segura são anuladas, sem atribuir abandono aos jogadores. Anulação é resultado técnico separado, com vencedor e perdedor ausentes.
- Contar rodadas como ciclos normais dos dois jogadores, incluindo a rodada final incompleta. Turnos extras não criam rodada nova; registrar também o número de turnos efetivamente executados para evitar ambiguidade com `BattleState.turn`.
- Guardar horários de início e término e motivo do encerramento, além dos campos mínimos solicitados. Esses dados distinguem combate, desistência, abandono e anulação.
- Contabilizar vitórias por desistência/abandono nas missões de multiplayer, respeitando as equipes iniciais e requisitos existentes; anulações nunca contam. Uma política específica contra partidas combinadas pode ser avaliada antes do ranking competitivo.

## 4. Base atual e pontos de integração

| Local | Situação atual e adaptação prevista |
|---|---|
| `shared/src/core/battle.ts` | Motor puro com dois lados, previsão e execução; reutilizar sem dependências de rede e sem bot no PvP |
| `shared/src/contracts.ts` | Acrescentar contratos serializáveis do protocolo e resultados, possivelmente em módulo próprio |
| `backend/src/game/battle-repository.ts` | Contrato atual é orientado a uma conta; criar serviço/repositório próprio para dois participantes |
| `backend/src/db/battle-repository.ts` | Reutilizar padrões de transação, revisão, prazo e idempotência; não tratar o marcador `multiplayer` existente como PvP já implementado |
| `backend/src/db/character-unlocks.ts` | Hoje lê equipes de `battles.state`; adaptar para resultados compactos |
| `backend/src/app.ts` | Registrar plugin, autenticação do handshake e endpoint WebSocket |
| `backend/src/index.ts` | Integrar processamento de prazos, heartbeat e encerramento do serviço |
| `frontend/src/features/battle/BattleScreen.tsx` | Hoje presume usuário no lado `player`, usa HTTP/polling e limpa seleção ao aceitar revisões; separar transporte, perspectiva e versões de combo/turno |
| `frontend/src/features/menu/MainMenu.tsx` | Habilitar Multiplayer e navegação para busca de partida |
| `frontend/vite.config.ts` | Habilitar encaminhamento WebSocket no proxy de desenvolvimento |
| `deploy/Caddyfile` | Validar WSS no `reverse_proxy` existente, sem nova porta pública |

## 5. Arquitetura proposta

```text
Navegadores
  ├── HTTPS: autenticação, catálogo e demais APIs
  └── WSS: fila e partidas multiplayer
                     ↓
                Caddy / TLS
                     ↓
        Fastify + @fastify/websocket
          ├── autenticação e autorização
          ├── fila e serviço de partidas
          ├── motor compartilhado
          └── PostgreSQL
```

Começar com um único processo de aplicação. Conexões e distribuição de eventos ficam em memória; fila, vínculo dos participantes e estado temporário autoritativo ficam no PostgreSQL. O processo deve ter identificação de execução para reconhecer partidas órfãs após reinício. Não ativar múltiplas réplicas sem antes adicionar coordenação e distribuição de eventos entre processos.

O navegador usa WebSocket nativo. Manter HTTP/polling dos modos existentes até as etapas específicas de persistência. No PvP, o fluxo normal recebe eventos pelo WebSocket; reconexão solicita o estado oficial.

## 6. Fila e preparação

1. Autenticar e estabelecer conexão controladora antes de buscar partida.
2. Validar equipe, unidades habilitadas, desbloqueios e ausência de outra fila/partida ativa. Impedir também início de batalha contra bot enquanto houver reserva multiplayer.
3. Congelar a equipe para o emparelhamento; alterações posteriores no perfil/equipe não alteram a partida.
4. Inserir na fila com ordem estável de chegada. Requisição repetida devolve a inscrição existente.
5. Em transação, reservar os dois primeiros jogadores disponíveis, remover da fila e criar a partida com participantes e equipes.
6. Enviar estado de preparação; depois das confirmações, sortear o primeiro lado e iniciar o prazo.
7. Cancelamento e formação de partida concorrem sob o mesmo controle transacional: ou cancela a busca, ou retorna a partida criada.

Desconectar na fila remove a inscrição. Entradas sem conexão válida devem expirar para não bloquear a busca. Impedir automatch, contas duplicadas e duas partidas simultâneas por conta por restrições de dados e bloqueios transacionais, não apenas pela interface.

## 7. Protocolo e montagem do combo

Endpoint proposto: `WSS /api/multiplayer/live`. Nomes finais de mensagens serão definidos junto dos contratos tipados.

| Cliente → servidor | Servidor → cliente |
|---|---|
| Entrar/cancelar fila | Situação da fila, partida encontrada |
| Confirmar carregamento | Início e estado oficial da partida |
| Adicionar/remover ação | Alteração aceita e combo atualizado |
| Encerrar turno | Eventos de resolução e próximo turno |
| Desistir | Resultado definitivo |
| Solicitar estado | Snapshot para ressincronização |
| | Desconexão/reconexão do adversário, erros e confirmações |

- Comandos incluem ID único, partida e versão/turno esperados. A identidade vem da sessão, nunca de um `userId` fornecido pelo cliente.
- Serializar comandos por partida e usar bloqueio transacional como garantia final. Uma alteração aceita recebe sequência crescente e é publicada aos dois participantes após commit.
- Separar versão do combate, versão do combo e sequência de eventos. Edição do combo não pode simular troca de turno, limpar outra seleção ou disparar sons de resultado.
- Sincronizar cada operação válida, sem consolidar silenciosamente várias edições em uma só. WebSocket preserva ordem enquanto conectado; reconexão recupera snapshot e histórico temporário disponível.
- A interface prevê a edição imediatamente e reconcilia a confirmação/rejeição. Alterações pendentes são enviadas em ordem; encerrar turno deve aguardar as confirmações anteriores e referenciar a versão exata do combo aceito.
- Publicar uma ação quando habilidade e alvo obrigatório estiverem definidos. A seleção visual incompleta de alvo permanece local nesta entrega.
- Validar o combo inteiro com `previewActions`, inclusive dependências de energia nas remoções.
- Repetir um comando não repete seu efeito. Guardar deduplicação temporária e respostas compactas, sem persistir um snapshot completo por comando.
- Clientes ignoram eventos antigos/duplicados e pedem snapshot se detectarem lacuna. Snapshot é recuperação de estado, não reprodução garantida de todos os cliques ocorridos durante desconexão.
- IDs de lutadores e lados canônicos permanecem estáveis. A apresentação usa `mySide` para posicionar a equipe e traduzir vitória/derrota para cada usuário.

## 8. Relógio, resultado e progresso

O servidor verifica o prazo antes de cada comando e em rotina periódica. Ao expirar, descarta o combo e executa a passagem vazia pelo motor. O relógio do cliente é apenas apresentação; reconexão não reinicia o prazo.

Finalização usa uma única transação: bloquear partida e progressos em ordem consistente, conferir se continua ativa, gravar resultado único, atualizar missões e remover dados temporários. Vitória por combate, desistência, abandono e prazo disputam esse mesmo fluxo. A transação que confirmar primeiro determina o resultado; eventos posteriores não o alteram.

Após commit, publicar o resultado e manter o histórico terminal apenas em cache transitório limitado para a tela final. Se o envio falhar, o resumo persistido permite recuperar o resultado sem reexecutar a finalização. Falha de banco não pode produzir vitória confirmada apenas em memória.

## 9. Desconexão, sessão e operação

- Usar `ping/pong` do protocolo para detectar conexões silenciosamente mortas; definir e testar intervalo e prazo do heartbeat na implementação.
- Fechamento detectado inicia tolerância de 10 segundos. Queda silenciosa exige primeiro a detecção pelo heartbeat, portanto o tempo total pode ser maior.
- Reconexão autenticada recupera vínculo e estado oficial antes de liberar comandos. Uma nova conexão controladora invalida a anterior; identificador de geração impede que o fechamento antigo cause abandono da nova.
- Não usar `beforeunload` nem `visibilitychange` como prova de desistência.
- Verificar expiração/revogação da sessão em conexões duradouras. Sem autenticação válida, interromper comandos; ausência de reconexão válida segue a tolerância de desconexão. Não estender silenciosamente a sessão absoluta de uma hora.
- Na parada planejada, suspender fila e novos matches, aguardar partidas dentro do orçamento de shutdown e anular as restantes conforme a política proposta. Só depois fechar sockets, rotinas e pool.
- No início, reconciliar fila e partidas da execução anterior antes de aceitar novos matches. Falha de infraestrutura não deve gerar vitória artificial para um participante.
- Registrar métricas de conexões, fila, partidas, latência de comandos, rejeições, desconexões, anulações e falhas; não registrar cada payload de combate nem credenciais.

## 10. Persistência compacta e histórico

### Durante a partida

Manter temporariamente estado corrente, combo, histórico de eventos para a função Histórico de batalha, prazos, revisões, participantes e deduplicação. Atualizar o estado corrente; não criar uma versão histórica completa por clique. Remover inscrições canceladas e dados temporários órfãos por rotina de limpeza.

### Depois da partida

Persistir resumo com:

- ID único da partida e modo.
- IDs dos dois participantes; vencedor/perdedor quando houver resultado competitivo.
- Equipe inicial de cada um, com IDs estáveis de unidades e ordem dos slots, sem depender da equipe atualmente selecionada.
- Datas de início/término e total de rodadas.
- Campos complementares propostos: turnos executados e motivo do encerramento.

Não persistir permanentemente combos, eventos de ação, estado final completo ou respostas de comandos. A tela pode manter o histórico final em memória até a saída, com limite de tempo para o cache no servidor. Após limpeza ou reinício, não há replay nem recuperação garantida do histórico detalhado.

Resultado, progresso e remoção dos temporários devem ser atômicos. Anulações têm participantes e motivo, mas não vencedor/perdedor, e são excluídas de ranking e missões.

### Campanha e Batalha rápida

Esses modos também usam servidor; o termo “offline” na discussão refere-se ao jogo contra bot. Sua compactação é uma etapa própria, porque o código atual usa estado/histórico para batalhas ativas, equipes de vitórias para missões e datas de conclusão para campanhas.

Primeiro introduzir leitura compatível de resumos e registros legados, preservando modo, encontro, resultado, equipes relevantes às regras atuais e datas originais. Equipes iniciais e unidades resultantes de transformações não são necessariamente iguais; conferir a semântica das missões antes de substituir a fonte. Em seguida, migrar partidas encerradas sem recontar nem duplicar vitórias. Apenas depois de validar equivalência remover logs, comandos e estados antigos.

Não apagar partidas ativas, marcos de reset de missões, conclusões de campanha ou informações necessárias aos desbloqueios. Novas vitórias PvP devem chegar ao mesmo cálculo de missões através dos resumos, sem criar uma falsa batalha de uma única conta.

## 11. Segurança e capacidade

- Autenticar handshake com cookie de sessão existente e validar `Origin` explicitamente: a proteção atual ignora GET e não cobre sozinha o upgrade WebSocket.
- Autorizar participação, lado, turno e cada ação no servidor. Não transmitir e-mail ou sessão ao adversário; usar apenas dados públicos necessários.
- Validar schemas, tamanho de frame/mensagem e frequência por conexão/conta. O `bodyLimit` HTTP e os limites de rotas não substituem controles para frames WebSocket.
- Limitar buffers e tratar clientes lentos sem crescimento ilimitado de memória. Finalizar conexão travada e aplicar o fluxo de desconexão.
- Medir carga de sockets, mensagens, consultas e memória no Lightsail atual antes de definir capacidade de produção. Não presumir um número de jogadores suportado nem depender de Free Tier.

## 12. Ranking futuro

Os resumos permitem calcular vitórias, derrotas, aproveitamento e composição de equipes. O ranking deve incluir desistência/abandono como derrota e excluir anulações. Fórmula, desempates, temporadas, mínimo de partidas e eventual Elo serão definidos em entrega própria.

Não é necessário armazenar todas as ações para esse ranking. Auditoria/replays completos exigiriam outra política de retenção e não fazem parte deste plano.
