# Novo Quadro de missões — migration 056

Implementa as metas de `todo-list.md`. Todos os objetivos listados são de
**Batalha rápida** e são cumulativos (AND). Um adversário ou aliado dentre os IDs
de uma lista satisfaz aquela condição (OR); cada partida conta uma vez por meta.

## Objetivos

| Personagem/grupo | Vitórias | Adversários | Equipe/objetivo adicional |
|---|---:|---|---|
| Saqueadores I, II e Saqueadora I | 3 | 1 contra o próprio personagem | — |
| Jung I, Exal I e Monnica I | 5 | 3 contra o próprio personagem | 1 contra ele usando Ravi, Doko ou Anna, respectivamente |
| Curandeiro e Curandeira de Pontes | 5 | 3 contra o próprio personagem | 1 contra ele usando qualquer Saqueador |
| Drak de Pontes | 10 | 5 contra Drak | 3 contra Drak usando qualquer Saqueador |
| Saqueadores III, IV e Saqueadora II | 10 | 5 contra o próprio personagem | — |
| Trinity, Vlade e Passago | 10 | 5 contra o próprio personagem | 3 contra ele usando alguém de Pontes |
| Jung II, Exal II e Monnica II | 15 | 10 contra o próprio personagem | 5 vitórias usando sua versão I, contra qualquer adversário |
| Ravi Berzerk | 25 | 15 contra cada um de Jung II, Exal II e Monnica II | 10 vitórias usando Ravi base |
| Exal — Verdadeiro poder | 50 | 30 contra Ravi Berzerk | 30 usando Exal II e 15 usando Exal I |
| Besta Lendária Zéfiro | 100 | 30 contra cada grupo: Grimória, Pontes, Espinea | 50 sem nenhuma morte de aliado |
| General Abel, Guardiã da fronteira, Samurai Erlang | 10 | 5 contra o próprio personagem | — |
| Sábio e Emissário do castelo | 15 | 10 contra o próprio personagem | — |
| Grande rei Osiris | 25 | 15 contra ele | — |

Os nomes abreviados no pedido usam os IDs já existentes; Doko continua com seu
nome atual. Ravi muda para **Berzerk**, com Z, mantendo IDs e caminhos dos assets.

## Revelação e Premium

Os pontos de revelação configurados no CMS são preservados. A campanha serve
como revelação, sem repetir sua batalha como objetivo do cartão. Para Exal final
e Zéfiro, a revelação é obrigatoriamente a batalha 7 da campanha 1. Só vitórias
posteriores à primeira vitória salva nesse confronto contam para suas missões.

Ambos mantêm classificação Premium e preço, mas também possuem `unlock_rule`.
O quadro mostra suas missões e a identificação **Também disponível como Premium**.
Completar as metas concede a unidade pelo fluxo normal de sincronização; compras
e desbloqueios já persistidos permanecem válidos. Maga Ártemis continua somente
Premium. No CMS, **Também desbloquear por missão** habilita a dupla via.

## Grupos

- **Saqueadores:** as seis unidades da estrada, incluindo os três reforços.
- **Pontes:** Curandeiro, Curandeira e Drak.
- **Grimória:** Jung, Exal e Monnica nas versões I e II, mais Exal — Verdadeiro poder.
- **Espinea:** Trinity, Vlade e Passago.

## Vitórias sem mortes

O motor grava `wasDefeated` por combatente ao receber dano fatal. Ressuscitar não
apaga esse registro; Benção divina evita a derrota e não o ativa. Uma vitória
qualifica somente quando todos os aliados têm HP positivo e registro explícito
de nunca terem sido derrotados. Batalhas antigas sem esse dado não são presumidas
como perfeitas. A compactação guarda `noPlayerDeaths` no resumo; os resultados
multiplayer guardam a informação por participante para missões configuradas nesse modo.

## Atualização

A migration `056_new_mission_board.sql` atualiza os 27 personagens solicitados,
preservando preços, metadados alheios, equipes, contadores e aquisições. O seed
inicializa as regras em bancos novos e preserva autoria posterior. Publique a
migration junto do motor, backend, frontend e CMS atualizados.
