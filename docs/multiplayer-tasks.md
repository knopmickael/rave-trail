# Multiplayer: etapas e critérios de aceite

**Status:** implementação executada e validada localmente. Consulte [registro de execução](multiplayer-progress.md) e [guia operacional](deploy/multiplayer.md). Validação de WSS/Caddy no ambiente alvo, medição de capacidade do Lightsail e cache terminal PvP permanecem pendentes; não houve deploy.

Referência de regras, arquitetura e persistência: [plano de multiplayer](multiplayer.md). As propostas complementares da seção 3 desse plano precisam ser validadas antes das tarefas que dependem delas.

## Etapa 1 — Contratos e modelo de dados

- [x] **MP01 — Confirmar regras complementares.** Definir anulação por desconexão dupla/falha de infraestrutura, preparação, contagem de rodadas, campos complementares e crédito de missões em abandono/desistência.
- [x] **MP02 — Definir contratos compartilhados.** Comandos, eventos, códigos de erro, `mySide`, versões de combate/combo, sequência, confirmação e resultado por participante. Manter `shared` puro.
- [x] **MP03 — Criar migração e repositórios.** Fila, reserva única por conta, dois participantes, equipes congeladas, estado temporário, deduplicação e resultado compacto único por partida. Usar o próximo número de migração disponível no momento da implementação.
- [x] **MP04 — Preparar consultas de resultados.** Integrar vitórias multiplayer às missões sem depender de um estado completo permanente; preservar regras por modo, adversário, equipe e marcos de reset.

**Aceite:** modelo não permite automatch nem conta em duas reservas; rollback não deixa uma partida parcialmente criada; dados legados continuam legíveis. Resumos preservam a origem dos dados usada pelas missões.

## Etapa 2 — Fila e ciclo autoritativo

Depende de MP01–MP04.

- [x] **MP05 — Implementar entrada e cancelamento de fila.** Exigir conexão e sessão válidas, três unidades válidas/desbloqueadas, congelar equipe e tornar operações idempotentes. Expirar entradas sem conexão.
- [x] **MP06 — Emparelhar por ordem de chegada.** Reservar os primeiros dois disponíveis em transação, inclusive sob concorrência de cancelamento/desconexão. Impedir início de partidas contra bot enquanto houver reserva PvP e definir tratamento de batalha contra bot já ativa ao entrar na fila.
- [x] **MP07 — Preparar e iniciar partida.** Confirmar carregamento de ambos, tratar prazo de preparação e sortear o primeiro jogador sem vincular a vantagem à ordem da fila.
- [x] **MP08 — Validar e sincronizar combo.** Processar adições/remoções em ordem; validar atores, alvos, energia e dependências usando o motor. Deduplicar comandos e rejeitar versões vencidas.
- [x] **MP09 — Executar turnos e prazos.** Resolver combo aceito, lidar com turnos extras e estados de efeito; aos 45 segundos descartar combo e passar a vez sem ações. Contar rodadas/turnos segundo a definição aprovada.
- [x] **MP10 — Finalizar uma única vez.** Vitória por combate, desistência, abandono e anulação; resultado e atualização de progresso atômicos. Remover temporários após persistência segura e disponibilizar resultado recuperável.

**Aceite:** envio duplicado não duplica jogada nem progresso. Dois finalizadores concorrentes geram apenas um resultado. Prazo é imposto sem depender do navegador, e uma equipe editada fora da partida não altera seu snapshot.

## Etapa 3 — Transporte WebSocket e operação

Depende dos contratos; integração final depende da etapa 2.

- [x] **MP11 — Registrar `@fastify/websocket`.** Usar versão compatível com Fastify 5, declarar dependência no manifest/lockfile e expor endpoint no processo atual. Autenticar cookie e validar `Origin` no upgrade.
- [x] **MP12 — Implementar protocolo e publicação.** Validar mensagens, serializar processamento por partida, publicar somente após commit, confirmar/rejeitar comandos e oferecer snapshot para ressincronização.
- [x] **MP13 — Implementar heartbeat e reconexão.** Definir intervalo/timeout, tolerância de 10 segundos, conexão controladora e geração da conexão. Tratar expiração/revogação de sessão e impedir efeito de fechamento de socket antigo.
- [x] **MP14 — Proteger capacidade.** Limites de mensagens/payload/buffers, clientes lentos, limitação por conta e erros controlados. Métricas e logs sem segredos nem histórico permanente de payloads.
- [x] **MP15 — Integrar startup/shutdown.** Suspender matchmaking, drenar dentro do prazo operacional, tratar partidas restantes e reconciliar registros órfãos de execução anterior antes de aceitar matches.
- [ ] **MP16 — Validar proxies.** Encaminhamento WebSocket no Vite, WSS pelo Caddy e comunicação interna com o container da aplicação, sem nova porta pública.

**Aceite:** origem indevida e sessão inválida não abrem canal autorizado. Reconexão recupera estado, não reinicia turno e não perde para um evento de fechamento antigo. Falha de banco não publica vitória sem commit. Reinício/deploy segue a política de infraestrutura aprovada.

## Etapa 4 — Interface e experiência de partida

Depende do protocolo e ciclo autoritativo.

- [x] **MP17 — Habilitar Multiplayer.** Tela de equipe/busca com validação dos três slots, situação da fila, cancelamento, preparação e erros, em português e inglês.
- [x] **MP18 — Criar cliente de conexão.** Manter conexão fora de efeitos transitórios da tela, coordenar comandos pendentes, deduplicar eventos e pedir snapshot em lacunas. Distinguir desconexão de simples mudança de foco/visibilidade.
- [x] **MP19 — Adaptar tela de batalha.** Controlar `mySide`, mostrar equipe própria na posição habitual com IDs canônicos estáveis, nome público do adversário e turno correspondente. Preservar previsão local e reconciliar adições/remoções sem limpar indevidamente a seleção.
- [x] **MP20 — Encerrar turno e desistir.** Aguardar edições pendentes antes de confirmar turno; mostrar derrota/vitória correta para ambos, incluindo desistência e abandono. Preservar confirmação de desistência já usada pela interface.
- [x] **MP21 — Exibir desconexão e resultado.** Avisar tolerância/reconexão, recuperar partida após reload autenticado, oferecer retorno ao menu e nova busca após encerramento. Anulação não aparece como vitória nem derrota.
- [ ] **MP22 — Manter histórico temporário.** Mostrar eventos durante a batalha e na tela final; descartar ao sair e limitar cache terminal no servidor. Informar ausência de histórico quando apenas o resumo persistido puder ser recuperado.

**Aceite:** dois clientes reais veem cada edição aceita em ordem e controlam somente seus personagens no próprio turno. Atualizar combo não dispara sons de troca de turno/resultado. Navegação por teclado e mensagens de conexão permanecem utilizáveis.

## Etapa 5 — Compactação de partidas contra bot

Depende de MP03–MP04 e da finalização segura. É uma entrega separável do transporte PvP, mas necessária para cumprir a política geral de retenção discutida.

- [x] **MP23 — Adicionar leitura compatível e backfill.** Gerar resumos de partidas encerradas preservando ID, modo, encontro, resultado, datas e equipes necessárias às regras existentes. Não converter transformação de personagem em mudança retroativa da equipe inicial.
- [x] **MP24 — Verificar equivalência de progresso.** Comparar missões, marcos de reset, campanhas concluídas e desbloqueios entre fontes antigas e compactas. Evitar dupla contagem enquanto as duas fontes coexistirem.
- [x] **MP25 — Compactar e limpar.** Somente após equivalência, remover estados/logs/comandos detalhados de partidas encerradas e adotar limpeza no término das novas batalhas contra bot. Preservar partidas ativas e histórico temporário da tela.

**Aceite:** migração e reexecução são idempotentes; nenhum jogador perde progresso ou recebe crédito duplicado. Consultas de missão deixam de depender de `battles.state` para partidas compactadas.

## Etapa 6 — Verificação e publicação

- [x] **MP26 — Testar regras e concorrência.** Fila duplicada, dois matches simultâneos, cancelamento versus match, preparação interrompida, sorteio, equipe bloqueada/desabilitada, reserva PvP versus início de batalha contra bot e conta tentando controlar o adversário.
- [x] **MP27 — Testar protocolo e tempo.** Edições rápidas, duplicações, versão vencida, remoção dependente, eventos fora de sequência/lacunas, combo pendente ao confirmar, expiração sem ações, turnos extras e resultado por ambos os lados.
- [x] **MP28 — Testar desconexão e sessão.** Fechar aba, reload, queda silenciosa, reconectar antes/depois de 10 segundos, duas abas, fechamento de socket antigo, expiração/logout e desconexão dupla conforme regra aprovada.
- [x] **MP29 — Testar persistência e falhas.** Finalização concorrente, perda de confirmação após commit, banco indisponível, limpeza de temporários, reinício/deploy, anulação e equivalência dos resumos com missões.
- [ ] **MP30 — Validar dois navegadores e carga.** Percurso completo por WSS/Caddy, latência de sincronização, consumo de memória, frequência de queries, buffers, limpeza e capacidade do Lightsail. Documentar condições e resultados, sem anunciar capacidade antes de medir.
- [x] **MP31 — Executar checks e atualizar documentação.** Atualizar arquitetura, README e runbook com execução local, configuração, limites, shutdown, recuperação e interpretação das métricas.

Comandos existentes a executar no ambiente apropriado ao concluir a implementação:

```powershell
npm run typecheck
npm test
npm run test:db
npm run test:architecture
npm run build
npm run smoke:production
```

Adicionar aos comandos existentes testes direcionados de WebSocket e um fluxo real com dois clientes. Testes de banco usam exclusivamente banco de testes; a implantação das migrações em produção é uma operação de release, não uma verificação local.

## Ordem sugerida de entrega

1. Regras complementares, contratos e dados.
2. Fila e combate com dois usuários, comprovados por testes de serviço/banco.
3. WebSocket, ciclo de conexão e integração com proxies.
4. Interface e validação real de duas contas.
5. Compactação dos registros contra bot e verificação de progresso.
6. Medição, documentação operacional e publicação.

Não há prazo ou capacidade de jogadores comprometidos neste planejamento. Ranking, Elo, salas, convites e múltiplas réplicas terão planos próprios quando entrarem no escopo.
