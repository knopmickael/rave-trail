# Fundo de vídeo dos menus

## Objetivo e decisões

Usar `menu-background-default.mp4` no fundo compartilhado dos menus, preservando o vídeo ao navegar. `playbackRate` e `defaultPlaybackRate` são `0.5`, com loop, sem áudio ou controles.

Enquanto o MP4 é baixado por completo, mostrar um WebP extraído em 00:01. O jogo continua utilizável durante o download. Somente após `response.blob()` resolver criar uma URL local para o vídeo; isso garante o download completo, ao contrário de `canplaythrough`, que é apenas uma estimativa do navegador. Revogar a URL e abortar downloads na desmontagem ou ao ativar movimento reduzido. Falhas mantêm o poster. Pausar a reprodução com a aba oculta.

Após a vitória salva em `path-1-encounter-7`, aplicar ao poster/vídeo `grayscale(1) brightness(1.15)` e uma camada isolada com `mix-blend-mode: color`, gradiente `#997baa 0%, #b87d95 35%, #ca8075 65%, #dc9147 100%`. Os controles não são filtrados. O progresso pertence à conta autenticada e é consultado novamente pelo cache compartilhado ao trocar de tela; logout/troca de conta não conserva o filtro anterior. Mapas e batalhas preservam seus próprios cenários.

## Abordagens

- **Poster + download completo (escolhida):** frame leve imediato e reprodução somente com o arquivo inteiro em memória. Custo adicional aproximado de 5 MB de memória para o Blob.
- Vídeo pausado durante o buffering: evita o poster separado, mas exibir o frame depende do download e o navegador pode não baixar todos os chunks enquanto pausado.
- Reprodução progressiva: começa antes, mas não atende à preferência de aguardar todo o download.

O usuário delegou a escolha entre poster e frame pausado. Implementação inline, sem novas dependências de runtime; arquivos originais preservados. Validar download pendente, falhas, movimento reduzido, ciclo de visibilidade e progresso por conta.
