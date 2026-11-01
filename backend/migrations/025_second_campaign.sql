-- Campanha 02: conteúdo provisório para auditoria, sem alterar batalhas históricas.
INSERT INTO campaigns (id, chapter_number, title, description, background_path, sort_order, released)
VALUES ('path-2', 2, 'Além das Fronteiras',
  'História provisória: os heróis procuram a corte de Osiris e enfrentam a ameaça que desperta além das fronteiras.',
  '/media/campaigns/path-2.webp', 1, true)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, released = true;

INSERT INTO narrative_characters (id, name) VALUES
  ('general-abel', 'General Abel'), ('guardia-da-fronteira', 'Guardiã da fronteira'),
  ('samurai-erlang', 'Samurai Erlang'), ('sabio-do-castelo', 'Sábio do castelo'),
  ('emissario-do-castelo', 'Emissário do castelo'), ('grande-rei-osiris', 'Grande rei Osiris'),
  ('espadachim-lupus', 'Espadachim Lupus'), ('feiticeira-ravina', 'Feiticeira Ravina'),
  ('monge-omero', 'Monge Omero'), ('besta-lendaria-ravok', 'Besta lendária Ravok'),
  ('besta-lendaria-fenrir', 'Besta lendária Fenrir'), ('besta-lendaria-enkei', 'Besta lendária Enkei'),
  ('lorde-demonio-rakin', 'Lorde demônio Rakin'), ('mago-demonio', 'Mago demônio'),
  ('combatente-demonio', 'Combatente Demônio'), ('verdadeiro-rei-demonio', 'Verdadeiro Rei demônio'),
  ('maga-artemis', 'Maga Ártemis')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO units (id, character_id, name, version, description, max_hp, portrait_path, illustration_path, unlock_condition, provisional)
SELECT id, id, name, 'Além das Fronteiras', 'História e habilidades provisórias, sujeitas a revisão.', 100,
  '/media/characters/02/' || id || '.png', '/media/characters/02/' || id || '.png',
  '{"kind":"battle-wins","description":"Vença 100 batalhas na batalha rápida."}'::jsonb, true
FROM narrative_characters WHERE id IN (
  'general-abel', 'guardia-da-fronteira', 'samurai-erlang', 'sabio-do-castelo', 'emissario-do-castelo', 'grande-rei-osiris',
  'espadachim-lupus', 'feiticeira-ravina', 'monge-omero', 'besta-lendaria-ravok', 'besta-lendaria-fenrir', 'besta-lendaria-enkei',
  'lorde-demonio-rakin', 'mago-demonio', 'combatente-demonio', 'verdadeiro-rei-demonio', 'maga-artemis'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO unit_abilities (unit_id, slot_index, ability_id)
SELECT u.id, slots.ordinality - 1, slots.ability_id FROM units u
CROSS JOIN LATERAL unnest(ARRAY['simple-strike', 'guard', 'retain-energy', 'strong-strike']) WITH ORDINALITY AS slots(ability_id, ordinality)
JOIN abilities a ON a.id = slots.ability_id
WHERE u.portrait_path LIKE '/media/characters/02/%'
ON CONFLICT DO NOTHING;

INSERT INTO encounters (id, campaign_id, position, title, story, map_x, map_y, provisional) VALUES
  ('path-2-encounter-1', 'path-2', 1, 'Os guardiões da fronteira',
    'Após a queda de Exal, pistas sobre os ataques levam Ravi, Doko e Anna para além de Berdal. Na fronteira do reino de Osiris, o General Abel, a Guardiã da fronteira e o Samurai Erlang exigem uma prova de suas intenções antes de permitir que alcancem a corte.', 46.3, 67.5, true),
  ('path-2-encounter-2', 'path-2', 2, 'A prova da corte',
    'O Sábio e o Emissário do castelo recebem os viajantes diante do Grande rei Osiris. A corte suspeita que as mesmas forças que arruinaram as rotas de Berdal estejam enfraquecendo os selos do reino. Um confronto de avaliação decide se os heróis estão preparados para investigar. Após a prova, Maga Ártemis compartilha os registros dos santuários esquecidos.', 35.8, 50.2, true),
  ('path-2-encounter-3', 'path-2', 3, 'O caminho dos santuários',
    'Guiados pelos registros da corte, os heróis encontram Espadachim Lupus, Feiticeira Ravina e Monge Omero. Os três protegem a trilha dos santuários e recusam entregar seus segredos a desconhecidos. Superar a prova permitirá descobrir quem está corrompendo os selos antigos.', 43.5, 41.8, true),
  ('path-2-encounter-4', 'path-2', 4, 'As três bestas ancestrais',
    'Ravok, Fenrir e Enkei despertam diante do último santuário. A corrupção transformou seus instintos de proteção em fúria. Os heróis precisam enfrentar as três bestas lendárias para alcançar o selo e revelar a passagem usada pelas forças demoníacas.', 67.8, 70.2, true),
  ('path-2-encounter-5', 'path-2', 5, 'A vanguarda de Rakin',
    'Além do selo rompido, Lorde demônio Rakin reúne um Mago demônio e um Combatente Demônio para abrir caminho até o reino. Derrotar a vanguarda interromperá a invasão, mas a energia por trás de Rakin revela um inimigo ainda maior. Osiris decide acompanhar pessoalmente o confronto final.', 74.5, 33, true),
  ('path-2-encounter-6', 'path-2', 6, 'O verdadeiro rei demônio',
    'No trono além da fenda, o Verdadeiro Rei demônio revela que os ataques às rotas comerciais eram parte de um plano para isolar os reinos. Grande rei Osiris ocupa um dos três slots da equipe para ajudar os heróis a enfrentar a entidade e fechar a passagem. A vitória encerra esta etapa da investigação e prepara a próxima jornada.', 85.4, 25.2, true)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, story = EXCLUDED.story, provisional = true;

DELETE FROM encounter_enemies WHERE encounter_id LIKE 'path-2-encounter-%';
INSERT INTO encounter_enemies (encounter_id, slot_index, unit_id)
SELECT formation.encounter_id, slots.ordinality - 1, slots.unit_id FROM (VALUES
  ('path-2-encounter-1', ARRAY['general-abel', 'guardia-da-fronteira', 'samurai-erlang']),
  ('path-2-encounter-2', ARRAY['sabio-do-castelo', 'emissario-do-castelo', 'grande-rei-osiris']),
  ('path-2-encounter-3', ARRAY['espadachim-lupus', 'feiticeira-ravina', 'monge-omero']),
  ('path-2-encounter-4', ARRAY['besta-lendaria-ravok', 'besta-lendaria-fenrir', 'besta-lendaria-enkei']),
  ('path-2-encounter-5', ARRAY['lorde-demonio-rakin', 'mago-demonio', 'combatente-demonio']),
  ('path-2-encounter-6', ARRAY['verdadeiro-rei-demonio'])
) AS formation(encounter_id, unit_ids)
CROSS JOIN LATERAL unnest(formation.unit_ids) WITH ORDINALITY AS slots(unit_id, ordinality);

-- Jogadores que já concluíram a primeira campanha também recebem acesso à segunda.
UPDATE player_progress SET data = jsonb_set(data, '{availablePathIds}',
  COALESCE(data->'availablePathIds', '[]'::jsonb) || '["path-2"]'::jsonb),
  revision = revision + 1, updated_at = now()
WHERE data->'completedEncounters' @> '["path-1-encounter-1","path-1-encounter-2","path-1-encounter-3","path-1-encounter-4","path-1-encounter-5","path-1-encounter-6","path-1-encounter-7"]'::jsonb
  AND NOT COALESCE((data->'availablePathIds') ? 'path-2', false);
