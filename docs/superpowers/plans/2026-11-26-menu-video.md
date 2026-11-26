# Menu Video Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fundo dos menus com MP4, poster de 00:01, download completo antes de reproduzir e filtro de entardecer por progresso.

**Architecture:** `SkyBackground({ sunset?: boolean })` permanece montado uma vez em `GameApp`; baixa o arquivo como Blob antes de conectar o vídeo. `GameApp` mantém o usuário e o estado do filtro vinculado ao ID da conta; consultas usam o cache existente. Remover a camada estática anterior do MainMenu.

**Tech Stack:** React, TypeScript, CSS, Fetch/Blob e Vitest existentes.

**Spec:** `docs/superpowers/specs/2026-11-26-menu-video-design.md`.

## Global Constraints

- `playbackRate = defaultPlaybackRate = 0.5` em ambos os temas.
- CSS exatamente como no HTML fornecido; mesmo MP4 nos dois temas.
- Download não bloqueia interação. Movimento reduzido não solicita o vídeo.
- Preservar os arquivos do usuário e o `todo-list.md` atualmente vazio.

## Review Focus

- Body recebido mas Blob ainda pendente: permanecer no poster sem reproduzir.
- Fetch/decodificação/autoplay falham: poster utilizável, sem rejeição não tratada.
- Movimento reduzido/desmontagem durante download: abortar e não deixar URLs locais vivas.
- Filtro muda/tela muda: mesma instância de vídeo e mesma URL, sem reinício.
- Conta nova/logout ou resposta atrasada: não reutilizar entardecer de outra conta.

### Task 1: Poster
- [x] Extrair WebP do frame 00:01 usando o navegador/ferramenta de autoria disponível; confirmar imagem e dimensões.

### Task 2: Playback e temas
**Files:** `frontend/src/components/SkyBackground.tsx`, `sky-background.css`, `SkyBackground.test.tsx`, `frontend/src/assets.ts`, `frontend/src/styles/base.css`.
**Interface:** `SkyBackground({ sunset = false }: { sunset?: boolean })`.
- [x] Testar Blob pendente versus completo, 0.5×, falhas, visibilidade, movimento reduzido, cleanup e troca de filtro sem reinício; observar falhas.
- [x] Implementar poster, fetch abortável, object URL, loop e filtros isolados.
- [x] Rodar os testes do componente e confirmar aprovação.

### Task 3: Progresso e integração
**Files:** `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/App.test.tsx`, `frontend/src/features/menu/MainMenu.tsx`, `MainMenu.test.tsx`, `menu.css`, `frontend/src/features/battle/BattleLoading.test.tsx`, `docs/assets/video.md`, `docs/chapter-one-expansion.md`.
**Interface:** `GameContent` recebe `user: User | null`, `setUser: Dispatch<SetStateAction<User | null>>` e `onBackgroundChange`; consulta o progresso com o tratamento de sessão existente. O estado do tema compartilhado fica vinculado à conta em GameApp.
- [x] Testar vitória salva/atualizada, navegação, logout e resposta atrasada no App; observar falhas.
- [x] Mover o fundo único para GameApp e substituir a camada antiga do MainMenu pelo tema compartilhado.
- [x] Rodar `npm test`, `npm run typecheck`, `npm run build` e `git diff --check`.
- [x] Conferir no navegador poster durante download, reprodução, ambos os temas e screenshots desktop; conferir redução de movimento e restrição mobile existente.
- [x] Atualizar documentação e registrar resultados. Não commitar/pushar sem pedido para esta alteração.

## Execução

- Task 1: poster extraído pelo canvas do navegador em 00:01, 1280×720, 27.690 bytes. Imagem conferida visualmente.
- Task 2: testes de carregamento/temas observados falhando antes da implementação; 9 testes do componente aprovados após a implementação.
- Task 3: regras de progresso movidas dos testes isolados do MainMenu para integração no App. Navegador confirmou poster durante corpo pendente, menu utilizável, reprodução real em 0.5× após completar o stream, mesma instância ao mudar tema e filtro CSS exato sem afetar controles. Movimento reduzido e bloqueio mobile existente também verificados; sem erros de página.
- Revisão independente encontrou tratamento de 401 ausente numa atualização tardia do fundo. Teste específico reproduziu a falha (RED); consulta passou a usar o handler compartilhado de expiração da sessão em GameContent (GREEN). Sem outras pendências levantadas.
- Validação final após a correção: `npm test` **384/384**, `npm run typecheck`, `npm run build` e `npm run smoke:production` aprovados.
