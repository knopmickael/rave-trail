# Capitães, chefe final e entardecer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os cinco itens atuais do `todo-list.md`, validar, aplicar a migration local e fazer commit/push para `develop`.

**Architecture:** Elegibilidade dos capitães e HP do chefe são decididos no backend; o catálogo jogável mantém Exal com 100 HP. O menu consulta o progresso autoritativo e aplica uma camada decorativa de entardecer somente após a vitória final. A migration 050 reativa o elenco da campanha 2 e restaura formações originais somente onde o desligamento anterior deixou encontros vazios.

**Tech Stack:** TypeScript, React/CSS, Fastify, PostgreSQL e Vitest existentes.

**Spec:** `todo-list.md`.

## Global Constraints
- Kalis e Ridan são adversários iniciais, mas sua aquisição jogável continua seguindo suas missões.
- Exal final tem HP atual/máximo 200 apenas como inimigo de `path-1-encounter-7`; catálogo, jogador, rápidas e multiplayer usam o valor normal de 100.
- O entardecer usa o término salvo da batalha 7, persiste após recarga e não pode vazar para outras contas ou telas. Céu em tons laranja e violeta, preservando legibilidade e movimento reduzido.
- Apenas os ícones dos adversários têm rolagem na preparação de rápidas; explicação, início e cooldown continuam acessíveis. Lista navegável por teclado.
- Os 17 personagens da campanha 2 voltam a ser habilitados, preservando missões, preços, progresso e snapshots. Não conceder automaticamente personagens nem alterar a publicação da campanha.
- Formaçōes não vazias editadas pelo CMS são preservadas. Seed não volta a desabilitar personagens e respeita desativações posteriores pelo CMS.

## Review Focus
- Diferenciar disponibilidade como adversário e propriedade jogável dos capitães.
- Não alterar HP de Exal em outros modos, do jogador ou em snapshots existentes.
- Menu deve refletir progresso ao retornar de vitória e ao trocar de conta.
- Campanha 2 teve relacionamentos apagados pela migration 040; reativação precisa funcionar em banco novo e já populado.
- Controles de rápidas devem permanecer visíveis com muitos ícones, cooldown e altura baixa.

### Task 1: Regras de combate e disponibilidade
- [x] Testar capitães iniciais sem posse e Exal inimigo 200 versus jogador/rápidas 100; observar falha.
- [x] Atualizar constantes/repositório, mantendo snapshots isolados.

### Task 2: Menu e preparação de rápidas
- [x] Testar entardecer por progresso, montagem e troca de conta.
- [x] Implementar camada laranja/violeta no menu e rolagem somente nos adversários.
- [x] Conferir teclado, contadores e limites no navegador.

### Task 3: Banco e publicação
- [x] Testar reativação de todos os personagens e restauração de encontros vazios sem apagar autoria.
- [x] Criar `050_enable_second_campaign_characters.sql` e atualizar defaults do seed.
- [x] Executar testes completos, tipos/build e revisão; aplicar localmente com preservação de progresso.
- [x] Documentar, conferir diff/status/log e fazer commit/push para develop.
