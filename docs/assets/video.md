# Fundos animados

Vídeos em `frontend/public/media/video/`. As ferramentas de autoria ficam em `tools/assets/`.

## Céu animado

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

Os vídeos antigos do mapa e das batalhas não são carregados pela interface. O céu azul continua usando a animação e o fallback descritos acima.

Os arquivos públicos são a origem dos assets e são copiados pelo Vite para `frontend/dist/media/` durante o build. Alterações de imagens devem ser feitas em `frontend/public/media/` para persistirem nos próximos builds.
