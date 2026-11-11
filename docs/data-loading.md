# Carregamento de dados e assets

O frontend mantém um cache em memória durante a vida da página. Abrir ou voltar a uma seção não revalida os dados por tempo, foco da janela ou montagem do componente. Recarregar a página inicia uma nova carga, adequada ao conteúdo estável de cada build.

## Boot

Assim que a sessão é restaurada ou o login/cadastro termina, `preloadGameData` inicia em paralelo catálogo, progresso/equipe, missões, oponentes de batalha rápida e campanhas. Assim que a lista de campanhas chega, carrega os mapas disponíveis. Mapas bloqueados exigem autorização do servidor e são antecipados assim que a campanha é liberada.

Pedidos simultâneos para a mesma chave compartilham a mesma Promise, inclusive no StrictMode. As telas usam os valores já disponíveis desde seu primeiro render; se a carga ainda estiver em andamento, aguardam o pedido compartilhado. Falhas não ficam armazenadas: a tela mantém seu tratamento de erro e opção de tentar novamente.

## Atualização após ações

| Evento | Estratégia |
| --- | --- |
| Navegação entre seções | Reutiliza os JSONs em memória. |
| Adicionar, mover ou remover membro da equipe | Faz o PUT no servidor e aplica a equipe completa retornada ao progresso em cache, sem GET adicional. A persistência é na tabela PostgreSQL `player_team_slots`. |
| Vitória na campanha | Invalida e recarrega progresso, missões, oponentes, campanhas e mapas disponíveis; mantém o catálogo. |
| Vitória rápida | Invalida e recarrega progresso, missões e oponentes; mantém catálogo, campanhas e mapas. |
| Turnos, início, derrota e desistência | Executa as ações no servidor; sem recarga de progresso, pois esses eventos não alteram as recompensas/desbloqueios atuais. |
| Batalha ativa | Mantém sincronização de estado, deadlines e turnos do BOT diretamente no servidor. Essas respostas não usam cache. |
| Logout, nova autenticação ou sessão expirada | Limpa o cache; respostas antigas não podem repopulá-lo. |

A atualização pós-vitória começa ao receber o resultado, tanto pela resposta do turno quanto pela sincronização da batalha, e é deduplicada por ID da batalha. A tela de resultado não espera os GETs; a próxima seção compartilha os pedidos em andamento. Uma falha de atualização não transforma uma ação já aceita em erro de combate: os endpoints afetados continuam disponíveis para nova tentativa na tela de destino.

## Assets

As imagens fixas são antecipadas no boot. Cada JSON recebido é inspecionado imediatamente para antecipar retratos, ilustrações, ícones e capas em `/media/`. A fila deduplica URLs e limita a seis downloads concorrentes, com prioridade baixa, sem bloquear os JSONs ou o acesso ao menu. Imagens com erro liberam a fila e podem ser tentadas novamente. O módulo da tela de batalha também é antecipado; a transição usa apenas o carregamento real, sem o antigo atraso artificial de 700 ms.

Músicas e efeitos já são preparados no boot pelo `useGameAudio`, com `preload="auto"`; o fundo de vídeo é carregado pelo `SkyBackground`. Os assets usam o carregamento nativo do navegador, permitindo reutilização pelos elementos visuais e de áudio.
