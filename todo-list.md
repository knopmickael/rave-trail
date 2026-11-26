Capitão da guarda Kalis e Ridan devem estar disponíveis na Batalha rápida desde o início, afinal estão disponíveis no Quadro de missões desde o início, logo deveriam estar na lista de Adversários disponíveis desde o início

Exal - Verdadeiro poder deve possuir 200 de HP na batalha 7 da campanha 1 - claro que ao desbloquear o personagem e torná-lo jogável pelo usuário ele deverá possuir apenas 100 de HP

Ao finalizar a campanha 1 (vencer Exal - Verdadeiro poder) o plano de fundo do Menú principal do jogo (céu azul sky-background.webp) deverá adquirir outra cor, um laranja arrozado de entardecer

A lista de Adversários disponíveis na Batalha rápida deve ser scrollável (somente a listagem dos ícones dos personagens é scrollável)

Podemos desbloquear os demais personagens da campanha 2 que estão desativados

## Implementação

- [x] Kalis e Ridan entre os adversários iniciais de `QUICK_BATTLE_ALWAYS_UNIT_IDS`, sem filtro de desbloqueio nas rápidas; aquisição jogável continua pelas missões.
- [x] Exal - Verdadeiro poder com 200 HP apenas como inimigo em `path-1-encounter-7`; catálogo, jogador, rápidas e multiplayer mantêm 100 HP (`FINAL_EXAL_BOSS_HP`).
- [x] Menu principal com camada de entardecer (laranja/violeta) após vencer a batalha 7, baseada no progresso salvo; legibilidade e movimento reduzido preservados.
- [x] Lista de Adversários das rápidas com rolagem somente nos ícones; contador, início e cooldown sempre visíveis, inclusive em viewports baixos e com cooldown ativo.
- [x] Migration `050_enable_second_campaign_characters.sql` reativa os 17 personagens da campanha 2 e restaura apenas formações vazias; seed não volta a desabilitar.
- [x] Testes, typecheck, build, aplicação local da migration com progresso/equipes preservados.
