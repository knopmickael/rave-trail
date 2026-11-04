-- Tarefa 36: capitães da guarda, redistribuição de Golpe forte e ajustes da loja/campanha 02.
INSERT INTO narrative_characters (id, name) VALUES
  ('capitao-da-guarda-kalis', 'Capitão da guarda Kalis'),
  ('capitao-da-guarda-ridan', 'Capitão da guarda Ridan')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO units (id, character_id, name, version, description, max_hp, portrait_path, illustration_path, unlock_condition, provisional, roster_order)
VALUES
  ('capitao-da-guarda-kalis-base', 'capitao-da-guarda-kalis', 'Capitão da guarda Kalis', 'Capitão da guarda',
    'Capitão da guarda de Berdal, aliado dos protagonistas. Combina defesa, recuperação de energia e cura para sustentar a equipe.',
    100, '/media/characters/capitao-da-guarda-kalis-face.png', '/media/characters/capitao-da-guarda-kalis-body.png',
    '{"kind":"battle-wins","description":"Vença 3 partidas no modo Batalha rápida."}'::jsonb, false, NULL),
  ('capitao-da-guarda-ridan-base', 'capitao-da-guarda-ridan', 'Capitão da guarda Ridan', 'Capitão da guarda',
    'Capitão da guarda de Berdal, aliado dos protagonistas. Prepara os companheiros com Força interna antes de partir para o ataque.',
    100, '/media/characters/capitao-da-guarda-kalis-face.png', '/media/characters/capitao-da-guarda-kalis-body.png',
    '{"kind":"battle-wins","description":"Vença 3 partidas no modo Batalha rápida."}'::jsonb, false, NULL)
ON CONFLICT (id) DO UPDATE SET
  character_id = EXCLUDED.character_id, name = EXCLUDED.name, version = EXCLUDED.version,
  description = EXCLUDED.description, portrait_path = EXCLUDED.portrait_path,
  illustration_path = EXCLUDED.illustration_path, unlock_condition = EXCLUDED.unlock_condition;

INSERT INTO unit_abilities (unit_id, slot_index, ability_id) VALUES
  ('capitao-da-guarda-kalis-base', 0, 'simple-strike'),
  ('capitao-da-guarda-kalis-base', 1, 'guard'),
  ('capitao-da-guarda-kalis-base', 2, 'retain-energy'),
  ('capitao-da-guarda-kalis-base', 3, 'heal'),
  ('capitao-da-guarda-ridan-base', 0, 'simple-strike'),
  ('capitao-da-guarda-ridan-base', 1, 'guard'),
  ('capitao-da-guarda-ridan-base', 2, 'retain-energy'),
  ('capitao-da-guarda-ridan-base', 3, 'internal-strength')
ON CONFLICT (unit_id, slot_index) DO UPDATE SET ability_id = EXCLUDED.ability_id;

-- Saqueador da estrada I troca Força interna por Golpe forte.
UPDATE unit_abilities SET ability_id = 'strong-strike'
WHERE unit_id = 'road-raider-1-base' AND slot_index = 3;

-- Fera Lendária passa a ser exibida como Besta Lendária sem renomear os assets existentes.
INSERT INTO narrative_characters (id, name) VALUES ('legendary-beast', 'Besta Lendária')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

UPDATE units SET
  name = 'Besta Lendária',
  portrait_path = '/media/characters/fera-lendaria-face.png',
  illustration_path = '/media/characters/fera-lendaria-body.png'
WHERE id = 'legendary-beast-premium';

-- O capítulo 02 permanece oculto e bloqueado nesta versão.
UPDATE campaigns SET released = false WHERE id = 'path-2';
