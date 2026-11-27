# Redefinição de habilidades

Corte rápido
Novo efeito: o dano inicial da habilidade agora é de 25 ao invés de 20, os demais danos por turno permanecem iguais
Nova descrição textual: "Causa 25 de dano a um inimigo imediatamente e provoca sangramento, causando 5 de dano à cada turno de sua equipe pelos próximos 3 turnos."
Novo custo: 35

Uivo do lobo
Novo efeito: o dano inicial da habilidade agora é de 25 ao invés de 20 e ao invés de paralizar o usuário, causa queimadura, impedindo que ele receba curas e escudos por 3 turnos do seu time
Nova descrição textual: "Causa 25 de dano a um inimigo imediatamente e provoca queimadura, impedindo que ele receba curas e escudos pelos próximos 3 turnos de sua equipe."

Fúria devastadora
Novo efeito: o dano causado à cada inimigo vivo agora é de 45 ao invés de 35
Novo custo: 60

# Novas habilidades

Repelir dano
Custo: 35
Efeito: Protege um aliado fazendo com que qualquer habilidade de dano direcionada à ele no próximo turno inimigo devolva 30% do dano causado ao caster da habilidade (somente danos explícitos, não se aplica à efeitos de sangramento, envenenamento e etc).
Asset: /frontend/public/media/abilites/damage-reflection.png

Concentração profunda
Custo: 45
Efeito: Passa os próximos 2 turnos de sua equipe sem poder utilizar nenhuma habilidade, porém ao finalizar esse tempo, leva a barra de energia da equipe ao máximo independente de quanto já houver na barra.
Asset: /frontend/public/media/abilites/deep-concentration.png

Rugido do dragão
Custo: 35
Efeito: Causa 25 de dano a um inimigo imediatamente e provoca congelamento, impedindo que ele utilize qualquer habilidade no próximo turno de sua equipe.
Descrição textual: "Causa 25 de dano a um inimigo imediatamente e provoca congelamento, impedindo que ele utilize qualquer habilidade no próximo turno de sua equipe."
Asset: /frontend/public/media/abilites/dragons-roar.png

Explosão sísmica
Custo: 50
Efeito: Causa 35 de dano a cada inimigo vivo.
Asset: /frontend/public/media/abilites/seismic-explosion.png

Trono de gelo
Custo: 45
Efeito: Impede que o time inimigo utilize habilidades ofensivas pelos próximos 2 turnos deles.
Asset: /frontend/public/media/abilites/frozen-throner.png

## Implementação

- [x] Corte rápido: 25 de dano inicial, sangramento preservado, custo 35 e descrição atualizada.
- [x] Uivo do lobo: 25 de dano e queimadura por 3 turnos, substituindo o bloqueio total.
- [x] Fúria devastadora: 45 de dano em área e custo 60.
- [x] Repelir dano: reflexão de dano direto no próximo turno inimigo.
- [x] Concentração profunda: dois turnos futuros sem agir e energia completa ao finalizar.
- [x] Rugido do dragão: 25 de dano e congelamento por um turno.
- [x] Explosão sísmica: 35 de dano em área e custo 50.
- [x] Trono de gelo: bloqueio de ataques por dois turnos inimigos.
- [x] Contratos, campos do CMS, ícones de status, traduções e migration 055.

Detalhes e regras de duração: [docs/ability-redefinition.md](docs/ability-redefinition.md).
Assets encontrados em `frontend/public/media/abilities/`; Trono de gelo usa `frozen-throne.png`.
