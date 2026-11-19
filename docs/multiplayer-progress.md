# Execução — docs/multiplayer-tasks.md

Base: `96583fc`. Implementação na branch de planejamento existente, conforme continuação solicitada pelo usuário. Não executar migração, compactação ou deploy em produção.

## Decisões de execução

- Ruling: adotar as propostas da seção 3 sem nova entrevista, conforme autorização para execução autônoma: preparação limitada a 20 segundos, anulação se ambos desconectarem ou o processo reiniciar, turnos extras fora da contagem de novas rodadas e crédito de missões por vitórias competitivas — mantém o fluxo definido; custo se inadequado: ajustar política antes da publicação.
- Ruling: trabalhar no checkout e branch de funcionalidade já escolhidos pelo usuário, sem criar outro worktree — mantém o local esperado; custo: não há checkout paralelo isolado.
- Ruling: rejeitar entrada na fila com batalha contra bot ativa e impedir início de batalha contra bot durante reserva PvP — evita abandonar silenciosamente qualquer partida; usuário deve concluir/desistir da anterior.
- Ruling: serializar transações PvP com advisory lock transacional no MVP de processo único, mantendo estado temporário no PostgreSQL — simplifica correção de concorrência; custo: medir e subdividir locks antes de aumentar capacidade.
- Ruling: iniciar testes em container PostgreSQL descartável exclusivo, porta local 55439 — nenhum uso dos bancos configurados no ambiente do projeto.
- Ruling: prazo de preparação vencido anula e oferece nova busca manual, sem reinscrever automaticamente — evita busca surpresa após perda de foco; custo: clique adicional do jogador disponível.
- Ruling: no shutdown do MVP, suspender novas operações e anular as partidas antes de fechar sockets/pool, em vez de esperar partidas sem limite — encerramento determinístico compatível com o container atual; custo: deploy interrompe partidas em andamento.
- Ruling: detalhes terminais das batalhas contra bot são transitórios por cinco minutos, depois compactados em lotes de 100 por minuto — preserva retries HTTP e polling já existentes; custo: dados detalhados permanecem temporariamente no banco após o fim.
- Ruling: qualquer falha de persistência do serviço WebSocket exige reconciliação/anulação das partidas antes de aceitar novas decisões competitivas — não confiar em presença que deixou de ser gravada; custo: interrupção transitória do banco pode anular partidas de outros jogadores.
- Ruling: snapshots autoritativos completos em cada atualização, com revisão e sequência, em vez de protocolo de deltas — recuperação simples sem replay; custo: tráfego maior, a medir antes de escalar.

## Preflight

- Baseline: `npm test` → 31 arquivos / 344 testes aprovados.
- Contratos de combo/turno consumidos por serviço e interface: separar revisões de edição e combate; manter IDs canônicos e apresentar perspectiva no cliente.
- Resultados compactos consumidos por missões: ler fonte nova sem dupla contagem e preservar marcos/datas de registros legados antes de limpar dados.
- Sessões existentes expiram em uma hora: conexão não estende sessão; reconectar exige autenticação válida.

## Progresso

- Baseline preservado: após a primeira implementação, 348 testes unitários/UI e 98 testes PostgreSQL aprovados, typecheck e build aprovados.
- Navegador real, duas sessões isoladas: cadastro e preparação de contas sintéticas, fila, match, adição/remoção observada pelo adversário, dano oficial, reload com retomada e fechamento do browser com vitória do adversário após tolerância. Aviso mobile verificado em 390 × 844.
- Revisão independente encontrou quatro problemas importantes: falha de gravação de desconexão, desistência concorrente ao prazo, fila de comandos sem limite e qualidade dos contadores legados.
- Correções verificadas RED→GREEN em testes dedicados: reconciliação após falha; desistência continua após passagem automática de turno; limites de 16 comandos pendentes por conexão e 256 globais; marcador persistente de contagem aproximada para legado. Suite direcionada: 17 testes aprovados.
- Final: minor (deferred): não há cache de histórico terminal no servidor PvP; a tela conserva o histórico recebido, mas reconectar após o fim recupera apenas o resumo. O resultado competitivo continua durável.
- Verificação final: `npm test` → 348 testes / 33 arquivos aprovados; `npm run test:db` → 108 testes / 13 arquivos aprovados; `npm run typecheck`, `npm run test:architecture` (3 testes), `npm run build` e `npm run smoke:production` aprovados.
- Testes complementares cobrem vitória por combate, sorteio do segundo inscrito, turnos extras versus rodadas, preparação expirada, reconexão tardia antes do tick e cancelamento concorrente ao match.
- Documentação operacional concluída em `docs/deploy/multiplayer.md`. Pendências explícitas: WSS/Caddy na infraestrutura alvo, medição de capacidade/carga e cache terminal PvP; nenhuma publicação ou alteração de banco real.
- Após a validação manual do usuário, autorizado commit da implementação, envio da branch e abertura de MR para `develop`. Não executar merge automaticamente.
- Migrações 041–043 aplicadas posteriormente ao PostgreSQL local por solicitação do usuário, sem reexecutar seed; nenhuma migração de produção executada nesta sessão.
- Diagnóstico de integração com App Hub: seu wrapper removia `ws: true` do proxy Vite. Corrigido no repositório separado `app-hub`; o guia operacional registra essa dependência de desenvolvimento. Usuário confirmou o multiplayer funcional após o ajuste.
- Verificações repetidas antes do envio: 348 testes unitários/UI, 108 testes PostgreSQL, typecheck e build aprovados, usando banco descartável separado do banco local.
