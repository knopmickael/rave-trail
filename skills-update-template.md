# TAREFA 01 - Alterar habilidades existentes

NOME: `Reter energia`
NOVO EFEITO: `Recupera 20 de energia para a equipe, até o limite de 100.`

NOME: `Reter muita energia`
NOVO EFEITO: `Recupera 35 de energia para a equipe, até o limite de 100.`

NOME: `Guarda`
NOVO EFEITO: `Protege o próprio jogador reduzindo 15 de dano de cada golpe por dois turnos da própria equipe. Não acumula redução.`

NOME: `Investida`
NOVO EFEITO: `Uma investida física que causa 30 de dano a um inimigo.`

NOME: `Varredura tática`
NOVO EFEITO: `Causa 20 de dano a cada inimigo vivo.`
NOVO CUSTO DE ENERGIA: 25

NOME: `Golpe forte`
NOVO CUSTO DE ENERGIA: 30

NOME: `Drenar alma`
NOVO CUSTO DE ENERGIA: 25

NOME: `Turno extra`
NOVO CUSTO DE ENERGIA: 40

NOME: `Fúria devastadora`
NOVO CUSTO DE ENERGIA: 30

# TAREFA 02 - Adicionar habilidades novas

NOME: `Golpe simples II`
ASSET: `/frontend/public/media/abilites/simple-strike-II.png`
EFEITO: `Causa 30 de dano a um inimigo.`
CUSTO DE ENERGIA: 20

NOME: `Corte rápido`
ASSET: `/frontend/public/media/abilites/quick-slash.png`
EFEITO: `Causa 20 de dano a um inimigo instantâneamente e aplica um efeito de sangramento (debuff) que fará com que o inimigo sofra 10 de dano a cada turno dele por mais 3 turnos.`
CUSTO DE ENERGIA: 35

NOME: `Vórtex negro`
ASSET: `/frontend/public/media/abilites/dark-vortex.png`
EFEITO: `Golpeia todos os inimigos causando 15 de dano e impedindo que realizem qualquer ataque durante 1 turno, demais habilidades ainda poderão ser utilizadas.`
CUSTO DE ENERGIA: 30

NOME: `Invulnerabilidade`
ASSET: `/frontend/public/media/abilites/fast-move.png`
EFEITO: `Permite que o usuário fique invulnerável pelo próximo turno do time inimigo.`
CUSTO DE ENERGIA: 15

# TAREFA 03 - Redistribuir habilidades entre os personagens

Monnica de Grimória: troca `Guarda` por `Proteção coletiva`;

Curandeiro de Pontes: troca `Guarda` por `Proteção coletiva`;
Curandeira de Pontes: troca `Guarda` por `Proteção coletiva`;
Drak de Pontes: troca `Proteção coletiva` por `Invulnerabilidade`;

Trinity de Espinea: troca `Guarda` por `Invulnerabilidade`;
Vlade de Espinea: troca `Guarda` por `Invulnerabilidade`;
Passago de Espinea: troca `Investida` por `Golpe simples II`;
Passago de Espinea: troca `Guarda` por `Invulnerabilidade`;

Jung de Grimória II: troca `Golpe simples` por `Golpe simples II`;
Jung de Grimória II: troca `Guarda` por `Invulnerabilidade`;
Jung de Grimória II: troca `Reter energia` por `Reter muita energia`;
Jung de Grimória II: troca `Investida` por `Corte rápido`;

Ravi Berserk: troca `Investida` por `Golpe simples II`;
Ravi Berserk: troca `Guarda` por `Proteção coletiva`;

Exal - Verdadeiro poder: troca `Investida` por `Vórtex negro`;
Exal - Verdadeiro poder: troca `Proteção coletiva` por `Invulnerabilidade`;