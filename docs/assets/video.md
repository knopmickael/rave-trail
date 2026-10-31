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

## Mapa da primeira campanha

`mapa-campanha-animado-v2.webm` é o vídeo fornecido para o mapa onde ficam os sete pontos de batalha da campanha 01.

- 1920×1080, duração de 8 segundos, reprodução em loop, sempre silenciada e sem controles.
- Compartilha o mesmo espaço e as coordenadas percentuais da imagem original; fica atrás dos pontos, sem interceptar cliques.
- `frontend/public/media/images/mapa-campanha-01.png` permanece visível enquanto o vídeo carrega ou se a reprodução falhar.
- A preferência `prefers-reduced-motion` mantém somente o mapa estático. O vídeo pausa em abas ocultas, retoma do mesmo instante e é desmontado ao sair do mapa.
- O Vite inclui o WebM pronto no build; nenhuma ferramenta de conversão é necessária para executar o jogo.

## Cenários de batalha — 30 fps

Animações derivadas das duas imagens de batalha existentes, sem recursos externos:

| Arquivo | Uso | Movimento |
|---|---|---|
| `battle-clearing.webm` | Batalhas comuns e rápidas | Folhagem e nuvens com deslocamento suave, grama e partículas douradas |
| `battle-darkness.webm` | Duelo final da primeira campanha | Nuvens, névoa, brilho do portal e partículas roxas |

- WebM / VP9, 1600×900, **30 fps**, 12 segundos e **360 quadros** por arquivo, sem faixa de áudio.
- Deslocamentos e trajetórias periódicos, com ciclo de 12 segundos, para repetição contínua. O centro do terreno permanece estável.
- Aproximadamente 2,9 MB para a clareira e 2,4 MB para as trevas.
- A reprodução não reinicia ao selecionar habilidades ou trocar de turno. Pausa em abas ocultas e é interrompida ao sair da batalha.
- As imagens PNG originais são o fallback durante o carregamento, em falhas ou com `prefers-reduced-motion`.

Geração reproduzível com FFmpeg e o encoder `libvpx-vp9`, necessário somente para autoria:

```powershell
npm run assets:battles
# Somente um cenário:
npm run assets:battles -- forest
npm run assets:battles -- final
```

Se necessário, defina `FFMPEG_PATH` com o caminho do executável. O script substitui cada vídeo somente depois de concluir a codificação, preservando os PNGs originais. A taxa de 30 fps e os 360 quadros foram conferidos por decodificação integral; a cadência também foi medida via `requestVideoFrameCallback` no navegador.
