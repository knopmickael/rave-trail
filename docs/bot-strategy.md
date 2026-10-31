# Estratégia do BOT — busca do combo de maior dano

## Fonte e alcance

`planEnemyTurn`, em `shared/src/core/battle.ts`, é uma função pura, hardcoded e determinística. O mesmo código atende todos os personagens, encontros da campanha e batalhas rápidas. O conjunto de habilidades, a composição das equipes e o estado da partida determinam o resultado.

A busca cobre o **combo do turno atual**, com até uma ação por personagem que estava vivo no início do turno. Cada turno extra tem um novo planejamento pelo servidor, com a mesma pausa e as mesmas regras da batalha.

## Enumeração e validade

- Considera todas as ordens de personagens, habilidades disponíveis e alvos válidos.
- Avalia também encerrar o combo em qualquer prefixo, inclusive passar sem ações.
- Pode reter energia com um ou mais personagens antes de uma habilidade que ainda não era pagável.
- Reexecuta cada prefixo contra o estado inicial por `previewActions`, respeitando custos sequenciais, teto de energia, Guarda, HP, efeitos e fim da batalha.
- Não agenda ações de um personagem ressuscitado no mesmo turno. Esse personagem não estava entre os atores vivos inicialmente.
- Evita continuar a fila após o resultado e direcionar novos ataques a alvos já derrotados.

## Comparação dos combos

Os critérios são comparados **em ordem**, sem somar suporte ao dano:

1. **Maior dano efetivo total:** diferença entre o HP inicial e final dos adversários. Ataques em área somam o HP removido de todos os alvos; sobre-dano não é pontuado.
2. Mais adversários derrotados, quando o dano total é igual.
3. Se o combo já encerra a batalha, menor número de ações para chegar ao resultado.
4. Mais aliados ressuscitados.
5. Mais turnos extras obtidos.
6. Mais HP recuperado pela própria equipe, incluindo drenagem e recuperação limitada ao máximo.
7. Maior ganho de duração/cobertura de Guarda.
8. Mais energia restante.
9. Menos ações, se todos os benefícios anteriores forem iguais.

Essa comparação lexicográfica garante que um único ponto adicional de dano vence qualquer quantidade de cura ou proteção. Empates completos mantêm a primeira sequência encontrada na ordem estável dos slots, habilidades e alvos, sem sorteio.

Por exemplo: com Ravi, Doko e Anna e 15 de energia, reter energia permite uma Varredura tática que remove 45 HP dos três alvos cheios, superando dois golpes simples que removem 40 HP. Com energia zerada, a busca encontra duas retenções antes da Varredura.

## Reaproveitamento de estados

A busca memoriza os atores que já agiram, energia, turnos extras, resultado e HP/Guarda das duas equipes. Prefixos que chegam ao mesmo estado com os mesmos atores usados têm as mesmas continuações e precisam ser explorados apenas uma vez. Esse reaproveitamento não limita a lista de habilidades, sorteia amostras ou corta a busca por orçamento de tempo.

## Verificação

Validação desta entrega: **234 testes gerais**, **57 testes com PostgreSQL**, checagem de tipos por camada e build aprovados.

- Cenários dirigidos cobrem retenções intermediárias, distribuição de energia, ataques em área, escolha de alvos, Guarda, sobre-dano, eliminações, suporte, ressurreição, fim da batalha e ações sem benefício.
- Uma referência independente atribui uma ação (ou passar) a cada ator e enumera as permutações. O dano do planejador é comparado ao máximo dessa referência em 20 cenários de equipes, energia, HP e proteção.
- Testes de imutabilidade e determinismo verificam o snapshot e as definições de habilidades.
- A integração com PostgreSQL confere que o combo ótimo persistido é o mesmo executado após a pausa do BOT e que consultas concorrentes não duplicam a resolução.
- Medição local de 340 planejamentos, em 17 cenários: média de aproximadamente **2,5 ms**, percentil 95 de **14,8 ms** e máximo observado de **16,7 ms**. São medições dessa execução, não um limite de tempo aplicado à busca.
