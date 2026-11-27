-- todo-list.md: catálogo novo e rebalanceamento. O runner fornece transação/lock.
-- Não altera snapshots de batalhas, jogadores, equipes ou slots de habilidades.
WITH balance(id,damage,cost,description) AS (VALUES
  ('quick-slash',25,35,'Causa 25 de dano a um inimigo imediatamente e provoca sangramento, causando 5 de dano à cada turno de sua equipe pelos próximos 3 turnos.'),
  ('wolfs-howl',25,NULL::integer,'Causa 25 de dano a um inimigo imediatamente e provoca queimadura, impedindo que ele receba curas e escudos pelos próximos 3 turnos de sua equipe.'),
  ('fury-scream',45,60,'Causa 45 de dano a cada inimigo vivo.')
), prepared AS (
  SELECT a.id,a.effects,b.damage,b.cost,b.description,
    (SELECT min(position) FROM jsonb_array_elements(a.effects) WITH ORDINALITY AS e(effect,position)
      WHERE effect->>'kind'='damage') AS first_damage,
    (SELECT min(position) FROM jsonb_array_elements(a.effects) WITH ORDINALITY AS e(effect,position)
      WHERE effect->>'kind' IN ('ability-block','burn')) AS first_control
  FROM abilities a JOIN balance b ON b.id=a.id
)
UPDATE abilities a SET energy_cost=COALESCE(p.cost,a.energy_cost), description=p.description,
  effects=CASE WHEN p.first_damage IS NULL THEN jsonb_build_array(jsonb_build_object('kind','damage','amount',p.damage)) ELSE '[]'::jsonb END
    || (SELECT jsonb_agg(CASE
        WHEN position=p.first_damage THEN jsonb_set(effect,'{amount}',to_jsonb(p.damage))
        WHEN p.id='wolfs-howl' AND position=p.first_control THEN '{"kind":"burn","teamTurns":3}'::jsonb
        ELSE effect END ORDER BY position)
      FROM jsonb_array_elements(p.effects) WITH ORDINALITY AS entries(effect,position))
    || CASE WHEN p.id='wolfs-howl' AND p.first_control IS NULL THEN '[{"kind":"burn","teamTurns":3}]'::jsonb ELSE '[]'::jsonb END
FROM prepared p WHERE a.id=p.id;

INSERT INTO abilities (id,name,description,energy_cost,target,effects,icon_path) VALUES
  ('damage-reflection','Repelir dano',
    'Protege um aliado no próximo turno inimigo: devolve ao agressor 30% do dano direto efetivamente recebido, sem reduzir o dano sofrido. Não reflete sangramento ou outros danos por turno.',
    35,'ally','[{"kind":"damage-reflection","percent":30,"teamTurns":1}]'::jsonb,'/media/abilities/damage-reflection.png'),
  ('deep-concentration','Concentração profunda',
    'O usuário fica sem poder usar habilidades nos próximos 2 turnos de sua equipe. Ao voltar a agir, se estiver vivo, completa a energia da equipe até 100.',
    45,'self','[{"kind":"concentration","teamTurns":2}]'::jsonb,'/media/abilities/deep-concentration.png'),
  ('dragons-roar','Rugido do dragão',
    'Causa 25 de dano a um inimigo imediatamente e provoca congelamento, impedindo que ele utilize qualquer habilidade no próximo turno de sua equipe.',
    35,'enemy','[{"kind":"damage","amount":25},{"kind":"ability-block","teamTurns":1}]'::jsonb,'/media/abilities/dragons-roar.png'),
  ('seismic-explosion','Explosão sísmica','Causa 35 de dano a cada inimigo vivo.',
    50,'all-enemies','[{"kind":"damage","amount":35}]'::jsonb,'/media/abilities/seismic-explosion.png'),
  ('frozen-throne','Trono de gelo','Impede que os inimigos utilizem habilidades ofensivas pelos próximos 2 turnos de sua equipe.',
    45,'all-enemies','[{"kind":"attack-block","teamTurns":2}]'::jsonb,'/media/abilities/frozen-throne.png')
ON CONFLICT (id) DO NOTHING;
