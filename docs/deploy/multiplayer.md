# Operação do multiplayer

## Arquitetura e publicação

O multiplayer usa `@fastify/websocket` no mesmo processo Fastify das rotas HTTP. O navegador conecta em `/api/multiplayer/live`, com `ws` no desenvolvimento e `wss` sob HTTPS. O Caddy continua sendo a única entrada pública; não criar porta pública ou serviço AWS adicional.

**Executar apenas uma réplica da aplicação.** A distribuição dos eventos e o registro dos sockets são locais ao processo. O serviço serializa transações PvP com advisory lock PostgreSQL; múltiplas réplicas exigem outra estratégia de presença/distribuição. Uma segunda aplicação apontada para o mesmo banco pode anular partidas ao reconciliar o startup.

Antes de iniciar esta versão, aplicar as migrações **041–043**, pelo procedimento habitual de release. Não iniciar a API nova antes da migração. O frontend e o backend devem ser publicados juntos para compartilhar o protocolo.

Não existem novas credenciais ou variáveis obrigatórias. `DATABASE_URL` e `APP_ORIGIN` continuam obrigatórias. A origem deve corresponder exatamente ao endereço usado no navegador; o handshake WebSocket verifica essa origem e o cookie de sessão, inclusive em GET.

## Desenvolvimento local

```powershell
npm install
npm run db:migrate
npm run dev
```

Usar duas sessões/perfis de navegador isolados com contas diferentes. Cada conta precisa selecionar três personagens. Entrar em Multiplayer e clicar em Buscar partida; os dois clientes confirmam automaticamente que carregaram o estado inicial. O proxy Vite encaminha o upgrade para a API.

Se iniciar pelo **App Hub**, o wrapper `app-hub/lib/vite.mjs` também precisa preservar as opções de proxy do projeto, principalmente `ws: true` em `/api`. Um wrapper que substitui essas opções permite login HTTP, mas impede a conexão de batalha: o handshake na porta 5173 expira e ninguém entra na fila. A correção no App Hub preserva as opções e trata `proxyReqWs` ao traduzir uma origem LAN autorizada. Reiniciar o serviço Site / jogo no hub depois de atualizar esse wrapper.

Para teste automatizado de banco, `TEST_DATABASE_URL` deve apontar para banco exclusivo com sufixo `_test`, diferente do desenvolvimento/produção. A suíte trunca dados de usuários e deve rodar sem aplicação de demonstração usando o mesmo banco.

## Regras operacionais

- Fila FIFO global; não é necessário confirmar um convite ou escolher região.
- Não é permitido buscar partida com batalha contra bot ativa. Concluir ou desistir da anterior primeiro. Enquanto houver reserva PvP, novos combates contra bot são rejeitados, inclusive os encontros com aliados convidados.
- Equipe e definições são congeladas ao entrar na fila. A ordem dos inscritos não determina quem começa.
- Preparação tem prazo de 20 segundos. Falha de preparação anula sem vencedor e permite buscar novamente; não reinscreve automaticamente.
- Turnos têm 45 segundos. Expiração descarta o combo, inclusive ações já mostradas ao adversário.
- Fechamento de conexão inicia tolerância de 10 segundos. Heartbeat é enviado a cada aproximadamente cinco segundos, com terminação na checagem seguinte se não houver resposta. Uma queda silenciosa leva o tempo da detecção **mais** a tolerância.
- Reload autenticado retoma a partida se estiver dentro da tolerância. O relógio não reinicia.
- Uma nova conexão da mesma conta substitui a anterior; o cliente antigo recebe fechamento `4001` e não tenta reassumir automaticamente.
- Expiração/revogação da sessão impede comandos e fecha o socket (`4003`). A duração absoluta da sessão continua de uma hora.
- Desistir aplica derrota imediata. Perda de um participante após tolerância concede vitória ao outro; ausência dos dois anula.
- O MVP limita partidas a uma hora; atingir esse limite anula sem crédito competitivo.

## Falhas e manutenção

Uma falha inesperada de persistência coloca o serviço em recuperação. Antes da próxima operação, reconciliar o banco, anular partidas abertas e remover fila. Esse comportamento prefere perder uma partida em andamento a conceder vitória baseada em presença incorreta.

Startup também reconcilia partidas que ficaram abertas após falha do processo. Shutdown planejado suspende operações, grava anulações e encerra sockets antes de fechar o pool. **Deploy reinicia a aplicação e interrompe partidas em andamento nesta primeira versão.** Não há transferência de partidas para outro processo nem drain prolongado.

Falha ao enviar a confirmação depois do commit não repete dano, vitória ou progresso. O cliente recupera o estado/resumo. Histórico detalhado PvP existe na tela enquanto aberta; após encerramento e reconexão, só o resumo está garantido. Não há cache terminal no servidor nesta versão.

## Retenção

| Dados | Retenção |
|---|---|
| Fila PvP | Até cancelamento, desconexão, match ou reconciliação |
| Estado, combos, log e deduplicação PvP | Somente durante preparação/partida; removidos atomicamente ao finalizar |
| Resultado PvP | Resumo permanente com participantes, equipes iniciais, vencedor/perdedor, datas, rodadas, turnos e motivo |
| Detalhes de batalhas contra bot | Temporários por cinco minutos após terminar, para polling e retries HTTP |
| Compactação contra bot | Lotes de até 100 partidas por minuto, sem tocar ativas ou alterar a data original |
| Resultado contra bot | Resumo permanente com modo, encontro, conta, resultado e dados de equipes necessários às missões |

As consultas de missão leem tanto registros completos ainda temporários quanto resumos, sem duplicação. Dados de vitória após transformações mantêm a semântica anterior; equipes iniciais de partidas novas são armazenadas separadamente. Registros legados sem contador verificável ficam marcados como aproximados (`countersExact: false`), mesmo que tenham continuado após a atualização.

Depois da compactação, versões antigas da API que presumem `battles.state` sempre preenchido não são compatíveis. Um rollback precisa usar código compatível com resumos; não há reconstrução de ações apagadas. Nenhuma compactação de banco real foi executada durante o desenvolvimento desta entrega.

## Limites e diagnóstico

- Payload máximo: 16 KiB; compressão WebSocket desativada.
- Até 30 mensagens por segundo por conexão; frames binários são rejeitados.
- Até 16 comandos pendentes por conexão e 256 globalmente. Produtores acima disso são desconectados com `1008`.
- Até 512 contas conectadas ao canal por processo como limite de admissão, **não como capacidade de jogadores comprovada**.
- Buffer de saída acima de 256 KiB encerra cliente lento.
- Tentativas de handshake usam o rate limit da rota.

Logs registram falhas de serviço/conexão sem cookies, senhas ou payloads completos de combate. Conferir CPU, memória, transferência, conexões do PostgreSQL e atraso dos comandos antes de ampliar uso. O número de jogadores simultâneos suportado pelo plano Lightsail ainda precisa de medição na infraestrutura alvo; os limites de proteção não são um benchmark.

Validação já realizada: testes de serviço/PostgreSQL, sockets autenticados com `injectWS`, isolamento de contas/origens, limites de backlog, falha de desconexão, duas sessões reais via proxy Vite, adição/remoção, resolução de turno, reload e abandono. Validação WSS com certificado e Caddy na infraestrutura alvo ainda deve ocorrer na publicação; não foi feito deploy para esse teste.
