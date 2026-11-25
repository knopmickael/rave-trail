# Ordem da campanha e ilustrações — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar a sequência exata de 26 personagens solicitada na Lista de personagens e nas missões correspondentes, e ampliar a arte de corpo pela altura disponível.

**Architecture:** `ROSTER_UNIT_IDS` define a ordem inicial; a migration 048 atualiza `roster_order`, já usado pelas consultas de catálogo/missões. O ajuste de arte fica restrito ao painel de ilustração de corpo, mantendo proporção e centralização.

**Tech Stack:** TypeScript, PostgreSQL, React/CSS e Vitest existentes.

**Spec:** Pedido do usuário: Ravi, Doko, Anna, Kalis, Ridan, saqueadores I/II/I, Grimorianos I, curandeiros, Drak, saqueadores III/IV/II, Espinea, Grimorianos II, Ravi Berserk, Exal final e Besta Lendária.

## Global Constraints
- A ordem da campanha 02 e de conteúdo adicional é preservada após os 26 personagens indicados.
- Não alterar IDs, nomes, conteúdo de habilidades, progresso, equipes ou snapshots; aplicar a migration também a personagens editados no CMS.
- Futuros ajustes explícitos de ordem pelo CMS continuam usando `roster_order` e são preservados pelo seed.
- Ilustrações mantêm a proporção; priorizar a altura, centralizando o excesso lateral com overflow horizontal visível. Não recortar a arte pelo quadro nem alterar miniaturas/ícones. Informações e controles ficam à frente da arte.

## Review Focus
- Índice UNIQUE de ordenação durante permutas, incluindo posições ocupadas por registros CMS.
- Mesma ordem no catálogo, missões pertinentes e banco novo após seed.
- Proporções não padronizadas e margens transparentes das imagens novas.

### Task 1: Ordenação
- [x] Atualizar expectativa literal do catálogo e reproduzir falha.
- [x] Adicionar integração de ordenação de catálogo/missões, edições CMS e preservação de estado.
- [x] Atualizar `ROSTER_UNIT_IDS` e criar `048_campaign_roster_order.sql`.

### Task 2: Ilustrações e entrega
- [x] Medir os arquivos e ajustar o preenchimento pela altura no painel de corpo.
- [x] Conferir proporções e limites no navegador em resoluções desktop altas e baixas.
- [x] Executar testes pertinentes, tipos e build; aplicar migration local e conferir os dados.

## Verificação
- `npm test`: 375 aprovados; `npm run test:db`: 125 aprovados; typecheck e build aprovados.
- Migração 048 aplicada no banco local `rave_trail`, com os 26 IDs na sequência pedida. Progresso, equipes, snapshots, habilidades e metadados não relacionados à posição foram preservados.
- Navegador com API real e conta QA no banco `_test`: sequência conferida nas duas telas. Jung II, Monnica II e Saqueador IV preencheram 706 px de altura em 1440×900; Exal II preencheu 591 px em 1024×768, sem distorção ou overflow da página.
- A renderização anterior de Jung II teria aproximadamente 378 px de altura no mesmo quadro. Após o feedback do usuário, a arte mantém essa ampliação pela altura e pode transbordar horizontalmente sem corte pelo quadro.
- Conta QA e processos de navegador/API/Vite encerrados após a conferência.
- Ajuste de overflow após feedback: validado em 1440×900 e 1024×768 com Jung II, Exal II e a arte nova de Drak. Altura preenchida e proporção mantida, `overflow-x: visible` e nenhum ancestral recortando a ilustração. Painéis ficam acima da arte e a imagem não captura cliques. Os 13 testes de seleção e o build do frontend passaram novamente.
