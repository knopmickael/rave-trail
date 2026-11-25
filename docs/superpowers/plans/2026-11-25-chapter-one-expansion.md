# Expansão da campanha 01 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar todos os requisitos atuais de `todo-list.md`, incluindo banco local e migrations para produção.

**Architecture:** Catálogo e motor compartilhados continuam sendo usados pela prévia, API e BOT. A migration 046 atualiza somente o conteúdo solicitado; a 047 persiste o limitador de desistências por conta, sob o lock existente de `player_progress`.

**Tech Stack:** TypeScript, React, Fastify, PostgreSQL e Vitest existentes.

**Spec:** `todo-list.md`.

## Global Constraints
- Manter IDs dos encontros, progresso e unidades já conquistadas; partidas existentes conservam snapshots.
- Execução: 40 energia, dano normal 50 em um inimigo. Benção divina: 40 energia, um aliado vivo (inclui usuário), uma proteção contra dano fatal que deixa 1 HP; sem acumulação nem expiração antes de ser consumida. Não é Guarda/Invulnerabilidade, portanto Retaliação não a remove.
- Corte rápido: 30 energia, 20 dano imediato e sangramento 5 por três turnos. Ressurreição: HP máximo. Turno extra: apenas a descrição muda.
- Cinco unidades novas têm HP padrão 100; três saqueadores são personagens próprios e Exal/Monnica II são versões dos personagens narrativos existentes. Assets usam caminhos públicos `/media/...`.
- Requisitos listados substituem as metas anteriores das unidades indicadas. Gates: saqueadores na batalha 4, Espinea na 5, versões II na 6; Ravi Berserk conserva gate na batalha 7.
- Desistências rápidas em janela móvel menor que cinco minutos: a décima gera cinco minutos de bloqueio. Repetir a mesma desistência não conta duas vezes. Fechar uma rápida ativa ao começar outra batalha também conta; campanha e multiplayer não contam.
- Relógio autoritativo do servidor, bloqueio por conta e persistente após recarga; botão mostra contagem regressiva e o backend rejeita tentativas diretas enquanto bloqueado.
- Preservar o CSS da barra de rolagem e os arquivos de autoria já presentes. Não fazer commit/push sem novo pedido.

## Review Focus
- Benção protege contra dano direto, drenagem e sangramento, mas apenas uma vez; ressurreição limpa efeitos antigos.
- Missões das versões II contam o ID da versão, não o original; exigência de Ravi usa a forma base.
- Seed não desfaz o conteúdo novo e futuras alterações no CMS continuam protegidas.
- Desistências concorrentes/idempotentes e substituição de partida não contornam o bloqueio.
- Contador recupera estado após recarga/foco, inclusive quando outra aba ativa o bloqueio.

### Task 1: Habilidades
- [x] Testar Execução, Benção em dano direto/dreno/sangramento, consumo único e ressurreição completa; observar falha.
- [x] Atualizar `shared/src/content/abilities.ts`, motor/BOT, CMS e ícone de efeito na batalha.
- [x] Atualizar os testes de balanceamento e traduções.

### Task 2: Campanha e catálogo
- [x] Testar os novos IDs, gates/metas e encontros, incluindo versões originais versus II.
- [x] Atualizar `units.ts`, `unlocks.ts`, `encounters.ts`, assets e traduções.
- [x] Criar `046_chapter_one_expansion.sql` e testar contra banco vazio e banco editado pelo CMS.

### Task 3: Limitador de desistências
- [x] Testar nove/dez desistências, janela expirada, cooldown completo, conta distinta, concorrência e abandono implícito.
- [x] Criar `047_quick_battle_surrender_limit.sql` e `backend/src/db/quick-battle-limit.ts`; integrar ao repositório sem resetar progresso.
- [x] Incluir disponibilidade atual no contrato de Batalha rápida e erro 429 com prazo para nova tentativa.
- [x] Testar e implementar atualização do botão/contador em `QuickBattle.tsx`, com atualização por foco e após rejeição do início.

### Task 4: Verificação e operação
- [x] Executar testes gerais/DB, typecheck e build; corrigir expectativas históricas afetadas pela expansão.
- [x] Revisar a implementação e verificar interface em desktop/mobile.
- [x] Aplicar migrations no banco local e conferir preservação de progresso e snapshots.
- [x] Documentar a nova campanha e a regra de desistências.

## Registro de execução
- Testes gerais: 375 aprovados. PostgreSQL: 124 aprovados, incluindo schemas isolados, idempotência e concorrência. Typecheck, build e smoke de produção aprovados.
- Revisão independente: reproduzidos e corrigidos conflito de posição com personagem CMS no índice 38 e resposta GET atrasada apagando cooldown recém-retornado por 429. Testes RED→GREEN para ambos.
- O seed aloca posições livres em ordem canônica sem mover posições reservadas pelo CMS. O contador usa versão de requisição para descartar respostas antigas.
- Migrations 046–047 aplicadas no banco local `rave_trail`; comparação dos registros anteriores de progresso, equipe e batalhas idêntica após a atualização.
- Navegador com API real e banco `_test`: novos personagens/habilidades e imagens conferidos em desktop; décima desistência pela interface produziu contador/botão desabilitado, persistiu após recarga e liberou após revalidação do prazo. Em 390 px, a aplicação mantém sua orientação já existente para jogar pelo computador.
- Os 12 novos arquivos de mídia retornaram HTTP 200. Conta QA e processos de verificação removidos ao concluir.
