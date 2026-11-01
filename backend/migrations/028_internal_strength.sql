INSERT INTO abilities (id, name, description, energy_cost, target, effects, icon_path)
VALUES ('internal-strength', 'Força interna',
  'Aumenta em 15 o dano das habilidades usadas por um aliado ou por si mesmo no próximo turno da equipe. Não acumula bônus.',
  35, 'ally', '[{"kind":"damage-boost","amount":15,"teamTurns":1}]'::jsonb, '/media/abilities/internal-strength.png')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
  energy_cost = EXCLUDED.energy_cost, target = EXCLUDED.target, effects = EXCLUDED.effects, icon_path = EXCLUDED.icon_path;

UPDATE unit_abilities SET ability_id = 'internal-strength'
WHERE unit_id = 'road-raider-1-base' AND ability_id = 'strong-strike';
