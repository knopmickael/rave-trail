# Atualização de habilidades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar todo o `todo-list.md`, aplicar no banco local atual e entregar a migration para o deploy de produção.

**Architecture:** Estender o contrato de efeitos e o motor compartilhado, usado pela API, prévia e BOT. Atualizar catálogo estático e catálogo PostgreSQL pela migration 044, mantendo snapshots de partidas e dados de jogadores.

**Tech Stack:** TypeScript, React, Fastify, PostgreSQL, SQL e Vitest existentes.

**Spec:** `todo-list.md`, com as inferências abaixo autorizadas pelo pedido de implementação por inferência.

## Decisões de implementação

- Proteção divina: Guarda de redução 10 por golpe, por três rodadas, sem acumulação; cura 10 no início dos próximos três turnos da própria equipe, antes de expirar. Cura limitada ao HP máximo, somente em vivos. Turnos extras também contam. A cura pertence ao escudo e termina ao removê-lo/substituí-lo.
- Retaliação: remove escudos ativos de todos os inimigos vivos (Guarda, proteção coletiva/divina e invulnerabilidade), incluindo cura vinculada. Não remove outros efeitos nem impede uma nova aplicação posterior.
- Uivo do lobo: dano 20 e bloqueio de todas as habilidades por dois turnos da equipe alvo. Não reutilizar o bloqueio apenas de ataques do Vórtex negro.
- “Ataque simples II” corresponde a `simple-strike-ii`; Jung sem II corresponde a `rival-a-base`; Besta Lendária corresponde a `legendary-beast-premium`. Trocas preservam posições dos slots.
- Ícones públicos: `/media/abilities/divine-protection.png`, `/media/abilities/retaliation.png`, `/media/abilities/wolfs-howl.png`.
- Revisão: preservar efeitos adicionais de `heal`, alterando apenas a quantidade. Resolver colisões de habilidades após as trocas priorizando os slots trocados e preenchendo somente os duplicados com habilidades ausentes do conjunto aprovado.

## Global Constraints

- Preservar os IDs, progresso, histórico e conteúdo do CMS fora das alterações solicitadas.
- Migration executada pelo runner existente, em transação com advisory lock e registro em `schema_migrations`.
- Aplicação local pela conexão disponível; MCP de banco não está disponível nesta sessão.
- Não criar commits nem realizar deploy nesta execução.

## Review Focus

- Cura não pode continuar depois de Retaliação nem ressuscitar derrotados.
- Bloqueio total impede suporte, retenções e turnos extras, mas não ações dos aliados livres.
- BOT e prévia usam as mesmas regras, sem gerar combos inválidos.
- Seed não desfaz o balanceamento; mudanças posteriores pelo CMS continuam preservadas.
- A atualização funciona tanto em banco já populado/editado quanto em banco inicializado do zero.

### Task 1: Motor e conteúdo
- [x] Adicionar testes de cura periódica, remoção de escudos, bloqueio total, duração, reaplicação e BOT; observar falha.
- [x] Estender `shared/src/content/abilities.ts`, `shared/src/core/battle.ts` e `battle-ai.ts`; atualizar conjuntos em `units.ts`.
- [x] Ajustar testes existentes afetados pelo novo balanceamento e executar os testes de combate.

### Task 2: Autoria e interface
- [x] Testar validação dos novos efeitos e bloqueio das habilidades na interface.
- [x] Atualizar `cms/contracts.ts`, `cms/server/schemas.ts`, instruções da IA, `BattleScreen.tsx` e i18n.
- [x] Conferir tipos e testes de interface/CMS.

### Task 3: Banco e entrega
- [x] Adicionar integração PostgreSQL verificando atualização de dados antigos, preservação de campos não solicitados, seed e nova autoria do CMS.
- [x] Criar `backend/migrations/044_divine_protection_retaliation_and_wolfs_howl.sql` com upserts das habilidades, balanceamento e trocas pontuais de relacionamentos.
- [x] Aplicar a migration localmente e consultar os dados persistidos.
- [x] Executar testes, integração PostgreSQL, typecheck e build; atualizar documentação de operação.

## Registro de execução

- Revisão independente encontrou colisões UNIQUE em conjuntos editados e perda de efeitos adicionais de cura. Ambos reproduzidos em testes PostgreSQL antes da correção e verificados depois; sem pendências menores.
- `npm test`: 357/357; `npm run test:db`: 112/112, incluindo quatro testes novos em schema isolado.
- `npm run typecheck`, `npm run build` e `npm run smoke:production`: aprovados.
- Migration 044 aplicada via runner existente em `127.0.0.1:5432/rave_trail`, sem seed; fingerprints de progresso, slots de equipe e batalhas idênticos antes/depois.
- CMS consultado no navegador em 1440 e 390 px: 23 habilidades, Proteção divina com cura 10/turnos 3, novos efeitos disponíveis, imagens carregadas, sem overflow horizontal nem erros de página; campo de cura navegável por teclado.
