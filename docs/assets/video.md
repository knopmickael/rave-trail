# Fundos animados

Vídeos em `frontend/public/media/video/`. As ferramentas de autoria ficam em `tools/assets/`.

## Fundo atual dos menus

`menu-background-default.mp4` é o vídeo compartilhado pelas telas de menu: 1280×720, 40 segundos e aproximadamente 5,81 MB. É reproduzido sem áudio e sem controles, em loop, com `defaultPlaybackRate` e `playbackRate` iguais a **0.5**.

- `menu-background-poster.webp` é o frame de **00:01** extraído do próprio vídeo (1280×720, aproximadamente 28 KB). Aparece imediatamente e permanece disponível se houver erro de rede, decodificação ou bloqueio de autoplay.
- O download usa `fetch` com prioridade baixa e não bloqueia o jogo. Somente após `response.blob()` concluir é criada a URL local conectada ao vídeo; `canplaythrough` não é usado como garantia de download completo. O vídeo inicia em 00:01 e aparece com transição suave.
- O fundo fica montado uma única vez em `GameApp`: trocar de menu ou de tema não reinicia a reprodução nem baixa outro vídeo. Downloads pendentes são abortados e URLs locais são revogadas ao desmontar ou ativar movimento reduzido.
- A reprodução pausa quando a aba fica oculta. Com `prefers-reduced-motion: reduce`, somente o poster aparece e o MP4 não é solicitado.
- Depois da vitória salva em `path-1-encounter-7`, poster e vídeo recebem o filtro de `menu-background-filter.html`: `grayscale(1) brightness(1.15)` e uma camada isolada com `mix-blend-mode: color`, gradiente `#997baa 0%, #b87d95 35%, #ca8075 65%, #dc9147 100%`. Botões, textos e demais telas não são filtrados. O estado é vinculado à conta, revalidado pelo cache compartilhado ao navegar e removido no logout.

O MP4 original e o HTML de referência são preservados. Para regenerar o poster com FFmpeg, se disponível:

```powershell
ffmpeg -ss 1 -i frontend/public/media/video/menu-background-default.mp4 -frames:v 1 -c:v libwebp -quality 85 frontend/public/media/video/menu-background-poster.webp
```

## Céu animado anterior (ferramenta de autoria)

`sky-background.webm` é derivado exclusivamente de `frontend/public/media/images/sky-background.webp`.

- WebM / VP9, 1280×854, 24 fps, 24 segundos, sem faixa de áudio.
- Movimento periódico de translação e deformação suave, com período de 24 segundos para repetição contínua.
- A imagem original é preservada como fallback estático.

Para regenerar, instale FFmpeg com o encoder `libvpx-vp9` e execute na raiz:

```powershell
npm run assets:sky
```

Se o executável não estiver no PATH, configure `FFMPEG_PATH` com seu caminho completo. A ferramenta é necessária apenas para regenerar o vídeo; o arquivo pronto é incluído no build pelo Vite.

## Mapa e cenários de batalha estáticos

O mapa e as batalhas usam somente PNGs de `frontend/public/media/images/`:

| Arquivo | Uso |
|---|---|
| `mapa-campanha-01.png` | Mapa da primeira campanha, atrás dos sete pontos de batalha |
| `fight-background.png` | Batalhas comuns e rápidas |
| `fight-exal-background.png` | Duelo final da primeira campanha |

Os vídeos antigos do mapa e das batalhas não são carregados pela interface. O céu dos menus usa o MP4 e o poster descritos acima; `sky-background.webm` e sua imagem de origem foram preservados, mas não são carregados pelo fundo atual.

Os arquivos públicos são a origem dos assets e são copiados pelo Vite para `frontend/dist/media/` durante o build. Alterações de imagens devem ser feitas em `frontend/public/media/` para persistirem nos próximos builds.
