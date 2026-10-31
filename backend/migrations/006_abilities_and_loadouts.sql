-- Tarefas 06 e 07: novos alvos, habilidades e conjuntos aprovados.
ALTER TABLE abilities DROP CONSTRAINT abilities_target_check;
ALTER TABLE abilities ADD CONSTRAINT abilities_target_check
  CHECK (target IN ('enemy', 'ally', 'self', 'defeated-ally', 'all-enemies', 'all-allies', 'team'));

UPDATE abilities SET target = 'self',
  description = 'Protege somente o usuário: reduz 10 de dano de cada golpe por dois turnos da própria equipe. Não acumula redução.'
WHERE id = 'guard';
UPDATE abilities SET energy_cost = 25 WHERE id = 'heal';

INSERT INTO abilities (id, name, description, energy_cost, target, effects, icon_path) VALUES
  ('retain-energy-plus', 'Reter muita energia', 'Recupera 25 de energia para a equipe, até o limite de 100.',
    0, 'team', '[{"kind":"restore-energy","amount":25}]', '/media/abilities/retain-energy-plus.jpg'),
  ('soul-drain', 'Drenar alma', 'Causa 25 de dano a um inimigo e recupera 25 HP do usuário, sem ultrapassar o HP máximo.',
    30, 'enemy', '[{"kind":"drain","amount":25}]', '/media/abilities/soul-drain.jpg'),
  ('soul-drain-plus', 'Drenar existência', 'Causa 40 de dano a um inimigo e recupera 40 HP do usuário, sem ultrapassar o HP máximo.',
    35, 'enemy', '[{"kind":"drain","amount":40}]', '/media/abilities/soul-drain-plus.jpg'),
  ('fury-scream', 'Fúria devastadora', 'Causa 25 de dano a cada inimigo vivo.',
    25, 'all-enemies', '[{"kind":"damage","amount":25}]', '/media/abilities/fury-scream.jpg'),
  ('heal-plus', 'Recuperar muita vida', 'Restaura 30 HP de cada aliado vivo, sem ultrapassar o HP máximo.',
    40, 'all-allies', '[{"kind":"heal","amount":30}]', '/media/abilities/heal-plus.jpg'),
  ('resurrection', 'Trazer dos mortos', 'Ressuscita um aliado derrotado com metade do HP máximo.',
    60, 'defeated-ally', '[{"kind":"revive","hpRatio":0.5}]', '/media/abilities/resurrection.jpg')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
  energy_cost = EXCLUDED.energy_cost, target = EXCLUDED.target, effects = EXCLUDED.effects, icon_path = EXCLUDED.icon_path;

-- Recria somente os conjuntos alterados para evitar conflitos UNIQUE nas trocas entre slots.
DELETE FROM unit_abilities WHERE unit_id IN (
  'road-raider-2-base', 'rival-a-base', 'rival-b-base', 'passage-guardian-base',
  'guerreiros-habilidosos-a', 'guerreiros-habilidosos-b',
  'protagonist-main-transformed', 'rival-b-final-mode', 'legendary-beast-premium'
);
INSERT INTO unit_abilities (unit_id, slot_index, ability_id)
SELECT approved.unit_id, slots.ordinality - 1, slots.ability_id
FROM (VALUES
  ('road-raider-2-base', ARRAY['simple-strike', 'guard', 'retain-energy', 'secondary-special']),
  ('rival-a-base', ARRAY['simple-strike', 'guard', 'retain-energy', 'main-special']),
  ('rival-b-base', ARRAY['simple-strike', 'guard', 'retain-energy', 'soul-drain']),
  ('passage-guardian-base', ARRAY['main-special', 'guard', 'retain-energy', 'extra-turn']),
  -- As últimas substituições de Trinity prevalecem sobre as entradas repetidas.
  ('guerreiros-habilidosos-a', ARRAY['main-special', 'guard', 'retain-energy-plus', 'secondary-special']),
  ('guerreiros-habilidosos-b', ARRAY['main-special', 'guard', 'retain-energy', 'female-special']),
  ('protagonist-main-transformed', ARRAY['main-special', 'guard', 'retain-energy-plus', 'fury-scream']),
  ('rival-b-final-mode', ARRAY['main-special', 'guard', 'retain-energy-plus', 'soul-drain-plus']),
  ('legendary-beast-premium', ARRAY['heal-plus', 'female-special', 'retain-energy-plus', 'resurrection'])
) AS approved(unit_id, ability_ids)
JOIN units ON units.id = approved.unit_id
CROSS JOIN LATERAL unnest(approved.ability_ids) WITH ORDINALITY AS slots(ability_id, ordinality);
