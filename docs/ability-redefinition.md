# Redefinição de habilidades — migration 055

Implementação dos requisitos de `todo-list.md`. Publique o motor, frontend e a
migration `055_burn_reflection_and_concentration.sql` juntos.

## Catálogo

| Habilidade | Energia | Comportamento |
|---|---:|---|
| Corte rápido | 35 | 25 de dano imediato e sangramento de 5 nos três próximos turnos da equipe alvo. |
| Uivo do lobo | 35 | 25 de dano e queimadura por três turnos da equipe alvo; não bloqueia mais suas ações. |
| Fúria devastadora | 60 | 45 de dano em cada inimigo vivo. |
| Repelir dano | 35 | Um aliado devolve 30% do dano direto recebido no próximo turno inimigo. |
| Concentração profunda | 45 | Usuário passa os próximos dois turnos de sua equipe sem agir; depois completa a energia da equipe até 100. |
| Rugido do dragão | 35 | 25 de dano e bloqueio de todas as habilidades no próximo turno da equipe alvo. |
| Explosão sísmica | 50 | 35 de dano em cada inimigo vivo. |
| Trono de gelo | 45 | Bloqueia ataques de todos os inimigos nos próximos dois turnos da equipe deles. |

As cinco novas habilidades ficam disponíveis no catálogo e nos seletores visuais
do CMS, sem alterar automaticamente os quatro slots dos personagens. Seus assets
estão em `frontend/public/media/abilities/`; o caminho público é `/media/abilities/`.
O arquivo correto de Trono de gelo é `frozen-throne.png`.

## Regras do motor

- **Queimadura:** bloqueia cura direta, cura por dreno e cura vinculada à Guarda,
  além de novas aplicações de Guarda e Invulnerabilidade. Não remove os escudos
  existentes nem impede energia, ressurreição, Benção divina ou reflexão. A cura
  vinculada continua contando sua duração, mas os ticks bloqueados não são repostos.
  Expira antes dos efeitos de início do quarto turno da equipe afetada.
- **Reflexão:** não absorve dano. Calcula `floor(dano efetivamente recebido * 30/100)`
  por golpe direto, inclusive dreno, descontando antes a defesa e o limite de HP do
  aliado. O dano devolvido respeita a Guarda, Invulnerabilidade e Benção divina do
  agressor; não recebe bônus de ataque nem gera outra reflexão. Sangramento não
  reflete. Pode acontecer mesmo em um golpe fatal no aliado. Se matar o agressor,
  interrompe os golpes restantes da habilidade, e o dreno não o ressuscita.
  Reaplicar substitui o percentual/prazo; Retaliação não remove esse efeito.
- **Concentração:** somente no próprio usuário. A ação de aplicação é seguida por
  dois turnos futuros bloqueados; no início do turno seguinte, se ainda estiver
  vivo, o usuário completa a energia compartilhada até 100. Aliados continuam
  agindo normalmente. Morte ou ressurreição cancela a recompensa pendente. A
  conclusão acontece antes dos ticks de sangramento do novo turno: quem estava
  vivo ao concluir recebe a recompensa mesmo se o sangramento o derrotar em seguida.
- **Congelamento:** usa o contrato existente `ability-block`, com o ícone da
  habilidade que o aplicou. **Trono de gelo** usa `attack-block`: bloqueia dano,
  dreno e sangramento, mas mantém disponíveis habilidades de suporte.
- Turnos extras contam nos relógios correspondentes. A reflexão usa o relógio da
  equipe adversária; queimadura, concentração e bloqueios usam o da equipe alvo.

## CMS e persistência

O formulário manual oferece `burn`, `damage-reflection` e `concentration`, com
validação de alvo, percentual inteiro de 1–100 e duração de 1–20 turnos. O combate
mostra seus ícones e desabilita as ações do personagem em concentração. Nomes,
descrições e mensagens de interface possuem traduções para inglês.

A migration atualiza os campos solicitados das três habilidades existentes,
preservando nomes, imagens e efeitos adicionais de autoria. As cinco novas são
inseridas sem substituir registros já existentes com seus IDs. O seed preserva
autoria posterior pelo CMS. Snapshots de batalhas antigas continuam com seus
contratos antigos, inclusive Uivo com bloqueio de habilidades; equipes, progresso
e históricos não são reescritos.

Para atualizar o banco local, execute `npm run cms:local:db:setup` e reinicie o CMS
para carregar o novo contrato de validação. Para o jogo, reinicie o backend local
após a atualização. O deploy executa a migration pelo fluxo normal.

Os testes de repositório usam fixtures do catálogo base (migrations numeradas),
independentes das edições de autoria exportadas pelo CMS. O teste de integração
`new-abilities.db.test.ts` também verifica a cadeia completa real, incluindo essas
edições, enquanto os testes do CMS verificam a geração e o replay do SQL exportado.
