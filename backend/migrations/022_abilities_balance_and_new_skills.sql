-- Tarefas 01-03: balanceamento, novas habilidades e redistribuição dos conjuntos.
UPDATE abilities SET
  energy_cost = 0,
  description = 'Recupera 20 de energia para a equipe, até o limite de 100.',
  effects = '[{"kind":"restore-energy","amount":20}]'::jsonb
WHERE id = 'retain-energy';

UPDATE abilities SET
  energy_cost = 0,
  description = 'Recupera 35 de energia para a equipe, até o limite de 100.',
  effects = '[{"kind":"restore-energy","amount":35}]'::jsonb
WHERE id = 'retain-energy-plus';

UPDATE abilities SET
  description = 'Protege o próprio jogador reduzindo 15 de dano de cada golpe por dois turnos da própria equipe. Não acumula redução.',
  effects = '[{"kind":"guard","reduction":15,"teamTurns":2}]'::jsonb
WHERE id = 'guard';

UPDATE abilities SET
  description = 'Uma investida física que causa 30 de dano a um inimigo.',
  effects = '[{"kind":"damage","amount":30}]'::jsonb
WHERE id = 'main-special';

UPDATE abilities SET
  energy_cost = 25,
  description = 'Causa 20 de dano a cada inimigo vivo.',
  effects = '[{"kind":"damage","amount":20}]'::jsonb
WHERE id = 'secondary-special';

UPDATE abilities SET
  energy_cost = 30
WHERE id = 'strong-strike';

UPDATE abilities SET
  energy_cost = 25
WHERE id = 'soul-drain';

UPDATE abilities SET
  energy_cost = 40
WHERE id = 'extra-turn';

UPDATE abilities SET
  energy_cost = 30
WHERE id = 'fury-scream';

INSERT INTO abilities (id, name, description, energy_cost, target, effects, icon_path) VALUES
  ('simple-strike-ii', 'Golpe simples II', 'Causa 30 de dano a um inimigo.',
    20, 'enemy', '[{"kind":"damage","amount":30}]', '/media/abilities/simple-strike-II.png'),
  ('quick-slash', 'Corte rápido', 'Causa 20 de dano a um inimigo instantaneamente e aplica sangramento: 10 de dano a cada turno dele por mais 3 turnos.',
    35, 'enemy', '[{"kind":"damage","amount":20},{"kind":"bleed","amount":10,"turns":3}]', '/media/abilities/quick-slash.png'),
  ('dark-vortex', 'Vórtex negro', 'Golpeia todos os inimigos causando 15 de dano e impedindo que realizem qualquer ataque durante 1 turno. Demais habilidades ainda poderão ser utilizadas.',
    30, 'all-enemies', '[{"kind":"damage","amount":15},{"kind":"attack-block","teamTurns":1}]', '/media/abilities/dark-vortex.png'),
  ('fast-move', 'Invulnerabilidade', 'Permite que o usuário fique invulnerável pelo próximo turno do time inimigo.',
    15, 'self', '[{"kind":"invulnerable","teamTurns":1}]', '/media/abilities/fast-move.png')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
  energy_cost = EXCLUDED.energy_cost, target = EXCLUDED.target, effects = EXCLUDED.effects, icon_path = EXCLUDED.icon_path;

-- Recria somente os conjuntos alterados para evitar conflitos UNIQUE nas trocas entre slots.
DELETE FROM unit_abilities WHERE unit_id IN (
  'rival-female-base', 'guardian-healer-male-base', 'guardian-healer-female-base',
  'passage-guardian-base', 'guerreiros-habilidosos-a', 'guerreiros-habilidosos-b',
  'guerreiros-habilidosos-c', 'jung-de-grimoria-ii', 'protagonist-main-transformed',
  'rival-b-final-mode'
);
INSERT INTO unit_abilities (unit_id, slot_index, ability_id)
SELECT approved.unit_id, slots.ordinality - 1, slots.ability_id
FROM (VALUES
  ('rival-female-base', ARRAY['simple-strike', 'female-special', 'retain-energy', 'heal']),
  ('guardian-healer-male-base', ARRAY['simple-strike', 'female-special', 'retain-energy', 'heal']),
  ('guardian-healer-female-base', ARRAY['simple-strike', 'female-special', 'retain-energy', 'heal']),
  ('passage-guardian-base', ARRAY['main-special', 'fast-move', 'retain-energy', 'extra-turn']),
  ('guerreiros-habilidosos-a', ARRAY['main-special', 'fast-move', 'retain-energy', 'secondary-special']),
  ('guerreiros-habilidosos-b', ARRAY['main-special', 'fast-move', 'retain-energy', 'female-special']),
  ('guerreiros-habilidosos-c', ARRAY['simple-strike-ii', 'fast-move', 'retain-energy-plus', 'secondary-special']),
  ('jung-de-grimoria-ii', ARRAY['simple-strike-ii', 'fast-move', 'retain-energy-plus', 'quick-slash']),
  ('protagonist-main-transformed', ARRAY['simple-strike-ii', 'female-special', 'retain-energy-plus', 'fury-scream']),
  ('rival-b-final-mode', ARRAY['dark-vortex', 'fast-move', 'retain-energy-plus', 'soul-drain-plus'])
) AS approved(unit_id, ability_ids)
JOIN units ON units.id = approved.unit_id
CROSS JOIN LATERAL unnest(approved.ability_ids) WITH ORDINALITY AS slots(ability_id, ordinality);
