-- Gerada automaticamente pelo CMS local. Não editar após publicação.
-- A transação e o controle de aplicação são responsabilidade do migrador.

INSERT INTO narrative_characters (id,name) VALUES ('protagonist-main','Ravi Berserk') ON CONFLICT DO NOTHING;

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('narrative','protagonist-main',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();

INSERT INTO units (id,character_id,name,version,description,max_hp,portrait_path,illustration_path,unlock_condition,unlock_rule,enabled,roster_order)
      VALUES ('protagonist-main-transformed','protagonist-main','Ravi Berserk','Despertar','O despertar de Ravi durante a jornada revela uma força que ele ainda precisa compreender e aprender a controlar.',100,'/media/characters/ravi-berserk-face.png','/media/characters/ravi-berserk-body.png','{"kind":"battle-wins","description":"Vença 30 partidas no modo Batalha rápida. Derrote Jung de Grimória II na Batalha rápida 20 vezes utilizando Ravi de Berdal. Derrote Exal de Grimória II na Batalha rápida 20 vezes utilizando Ravi de Berdal."}','{"unitId":"protagonist-main-transformed","description":"Vença 30 partidas no modo Batalha rápida. Derrote Jung de Grimória II na Batalha rápida 20 vezes utilizando Ravi de Berdal. Derrote Exal de Grimória II na Batalha rápida 20 vezes utilizando Ravi de Berdal.","requirements":[{"kind":"battle-wins","mode":"quick","target":30,"description":"Vença 30 partidas no modo Batalha rápida."},{"kind":"battle-wins","mode":"quick","target":20,"description":"Derrote Jung de Grimória II na Batalha rápida 20 vezes utilizando Ravi de Berdal.","opponentUnitIds":["jung-de-grimoria-ii"],"requiredPlayerUnitIds":["protagonist-main-base"]},{"kind":"battle-wins","mode":"quick","target":20,"description":"Derrote Exal de Grimória II na Batalha rápida 20 vezes utilizando Ravi de Berdal.","opponentUnitIds":["exal-de-grimoria-ii"],"requiredPlayerUnitIds":["protagonist-main-base"]}],"availableAfterEncounterId":"path-1-encounter-7"}',TRUE,(SELECT COALESCE(MAX(roster_order),-1)+1 FROM units)) ON CONFLICT (id) DO UPDATE SET character_id='protagonist-main',name='Ravi Berserk',version='Despertar',description='O despertar de Ravi durante a jornada revela uma força que ele ainda precisa compreender e aprender a controlar.',max_hp=100,portrait_path='/media/characters/ravi-berserk-face.png',illustration_path='/media/characters/ravi-berserk-body.png',unlock_condition='{"kind":"battle-wins","description":"Vença 30 partidas no modo Batalha rápida. Derrote Jung de Grimória II na Batalha rápida 20 vezes utilizando Ravi de Berdal. Derrote Exal de Grimória II na Batalha rápida 20 vezes utilizando Ravi de Berdal."}',unlock_rule='{"unitId":"protagonist-main-transformed","description":"Vença 30 partidas no modo Batalha rápida. Derrote Jung de Grimória II na Batalha rápida 20 vezes utilizando Ravi de Berdal. Derrote Exal de Grimória II na Batalha rápida 20 vezes utilizando Ravi de Berdal.","requirements":[{"kind":"battle-wins","mode":"quick","target":30,"description":"Vença 30 partidas no modo Batalha rápida."},{"kind":"battle-wins","mode":"quick","target":20,"description":"Derrote Jung de Grimória II na Batalha rápida 20 vezes utilizando Ravi de Berdal.","opponentUnitIds":["jung-de-grimoria-ii"],"requiredPlayerUnitIds":["protagonist-main-base"]},{"kind":"battle-wins","mode":"quick","target":20,"description":"Derrote Exal de Grimória II na Batalha rápida 20 vezes utilizando Ravi de Berdal.","opponentUnitIds":["exal-de-grimoria-ii"],"requiredPlayerUnitIds":["protagonist-main-base"]}],"availableAfterEncounterId":"path-1-encounter-7"}',enabled=TRUE;

DELETE FROM unit_abilities WHERE unit_id='protagonist-main-transformed';

INSERT INTO unit_abilities VALUES ('protagonist-main-transformed',0,'execution');

INSERT INTO unit_abilities VALUES ('protagonist-main-transformed',1,'guard');

INSERT INTO unit_abilities VALUES ('protagonist-main-transformed',2,'retain-energy-plus');

INSERT INTO unit_abilities VALUES ('protagonist-main-transformed',3,'fury-scream');

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('characters','protagonist-main-transformed',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();
