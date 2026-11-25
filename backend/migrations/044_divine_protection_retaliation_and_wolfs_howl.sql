-- Balanceamento do todo-list.md. O runner fornece transação e advisory lock.
-- Somente catálogo/relacionamentos: snapshots, equipes e progresso não são reescritos.
INSERT INTO abilities (id, name, description, energy_cost, target, effects, icon_path)
VALUES
  ('divine-protection', 'Proteção divina',
   'Protege todos os aliados vivos: reduz 10 de dano por golpe durante 3 turnos da equipe e cura 10 HP no início de cada um dos próximos 3 turnos da equipe (30 HP por aliado). Não acumula redução nem cura.',
   35, 'all-allies', '[{"kind":"guard","reduction":10,"teamTurns":3,"healPerTurn":10}]'::jsonb,
   '/media/abilities/divine-protection.png'),
  ('retaliation', 'Retaliação',
   'Remove imediatamente todos os escudos dos inimigos vivos, incluindo Guarda, Proteção coletiva, Proteção divina e Invulnerabilidade. Também interrompe a cura vinculada ao escudo removido.',
   30, 'all-enemies', '[{"kind":"dispel-shields"}]'::jsonb,
   '/media/abilities/retaliation.png'),
  ('wolfs-howl', 'Uivo do lobo',
   'Causa 20 de dano a um inimigo e impede que ele use qualquer habilidade nos próximos 2 turnos da equipe dele.',
   35, 'enemy', '[{"kind":"damage","amount":20},{"kind":"ability-block","teamTurns":2}]'::jsonb,
   '/media/abilities/wolfs-howl.png')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  energy_cost = EXCLUDED.energy_cost, target = EXCLUDED.target,
  effects = EXCLUDED.effects, icon_path = EXCLUDED.icon_path;

UPDATE abilities SET energy_cost = 25 WHERE id = 'fast-move';
UPDATE abilities SET
  description = CASE WHEN effects = '[{"kind":"heal","amount":20}]'::jsonb
    THEN 'Restaura 25 HP de um aliado vivo, sem ultrapassar o HP máximo.' ELSE description END,
  effects = (SELECT jsonb_agg(CASE WHEN effect->>'kind' = 'heal'
    THEN jsonb_set(effect, '{amount}', '25'::jsonb) ELSE effect END ORDER BY position)
    FROM jsonb_array_elements(effects) WITH ORDINALITY AS entries(effect, position))
WHERE id = 'heal';

-- Trocas por ID preservam slots e outras edições feitas no CMS. Quando o destino
-- já existe em outro slot, priorizamos a troca solicitada e preenchemos somente
-- o slot duplicado com uma habilidade ainda ausente do conjunto aprovado.
CREATE TEMPORARY TABLE ability_rebalance_loadouts ON COMMIT DROP AS
WITH swaps(unit_id, old_ability, new_ability) AS (VALUES
  ('rival-a-base', 'main-special', 'retaliation'),
  ('passage-guardian-base', 'main-special', 'simple-strike-ii'),
  ('passage-guardian-base', 'retain-energy', 'retain-energy-plus'),
  ('guerreiros-habilidosos-a', 'main-special', 'simple-strike-ii'),
  ('guerreiros-habilidosos-a', 'fast-move', 'guard'),
  ('guerreiros-habilidosos-a', 'retain-energy', 'retain-energy-plus'),
  ('guerreiros-habilidosos-b', 'main-special', 'simple-strike-ii'),
  ('guerreiros-habilidosos-b', 'fast-move', 'guard'),
  ('guerreiros-habilidosos-b', 'female-special', 'divine-protection'),
  ('guerreiros-habilidosos-c', 'fast-move', 'guard'),
  ('guerreiros-habilidosos-c', 'retain-energy-plus', 'retain-energy'),
  ('guerreiros-habilidosos-c', 'secondary-special', 'wolfs-howl'),
  ('protagonist-main-transformed', 'simple-strike-ii', 'quick-slash'),
  ('legendary-beast-premium', 'female-special', 'divine-protection')
), approved(unit_id, ability_ids) AS (VALUES
  ('rival-a-base', ARRAY['simple-strike', 'guard', 'retain-energy', 'retaliation']),
  ('passage-guardian-base', ARRAY['simple-strike-ii', 'fast-move', 'retain-energy-plus', 'extra-turn']),
  ('guerreiros-habilidosos-a', ARRAY['simple-strike-ii', 'guard', 'retain-energy-plus', 'secondary-special']),
  ('guerreiros-habilidosos-b', ARRAY['simple-strike-ii', 'guard', 'retain-energy', 'divine-protection']),
  ('guerreiros-habilidosos-c', ARRAY['simple-strike-ii', 'guard', 'retain-energy', 'wolfs-howl']),
  ('protagonist-main-transformed', ARRAY['quick-slash', 'female-special', 'retain-energy-plus', 'fury-scream']),
  ('legendary-beast-premium', ARRAY['heal-plus', 'divine-protection', 'retain-energy-plus', 'resurrection'])
), mapped AS (
  SELECT ua.unit_id, ua.slot_index, COALESCE(s.new_ability, ua.ability_id) AS ability_id,
    s.new_ability IS NOT NULL AS changed
  FROM unit_abilities ua
  LEFT JOIN swaps s ON s.unit_id = ua.unit_id AND s.old_ability = ua.ability_id
  WHERE ua.unit_id IN (SELECT unit_id FROM approved)
), ranked AS (
  SELECT *, row_number() OVER (PARTITION BY unit_id, ability_id ORDER BY changed DESC, slot_index) AS occurrence
  FROM mapped
), vacancies AS (
  SELECT unit_id, slot_index, row_number() OVER (PARTITION BY unit_id ORDER BY slot_index) AS position
  FROM ranked WHERE occurrence > 1
), missing AS (
  SELECT a.unit_id, slot.ability_id,
    row_number() OVER (PARTITION BY a.unit_id ORDER BY slot.position) AS position
  FROM approved a CROSS JOIN LATERAL unnest(a.ability_ids) WITH ORDINALITY AS slot(ability_id, position)
  WHERE NOT EXISTS (SELECT 1 FROM mapped m WHERE m.unit_id = a.unit_id AND m.ability_id = slot.ability_id)
)
SELECT unit_id, slot_index, ability_id FROM ranked WHERE occurrence = 1
UNION ALL
SELECT v.unit_id, v.slot_index, m.ability_id FROM vacancies v
JOIN missing m ON m.unit_id = v.unit_id AND m.position = v.position;

-- Recriar os relacionamentos evita conflitos transitórios entre índices UNIQUE.
DELETE FROM unit_abilities WHERE unit_id IN (SELECT unit_id FROM ability_rebalance_loadouts);
INSERT INTO unit_abilities (unit_id, slot_index, ability_id)
SELECT unit_id, slot_index, ability_id FROM ability_rebalance_loadouts;
