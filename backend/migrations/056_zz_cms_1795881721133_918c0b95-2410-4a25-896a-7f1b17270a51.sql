-- Gerada automaticamente pelo CMS local. Não editar após publicação.
-- A transação e o controle de aplicação são responsabilidade do migrador.

INSERT INTO narrative_characters (id,name) VALUES ('rival-female','Monnica de Grimória') ON CONFLICT DO NOTHING;

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('narrative','rival-female',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();

INSERT INTO units (id,character_id,name,version,description,max_hp,portrait_path,illustration_path,unlock_condition,unlock_rule,enabled,roster_order)
      VALUES ('rival-female-base','rival-female','Monnica de Grimória','Primeiro encontro','Integrante do trio de mercenários rivais. Apoia seus companheiros recuperando a vida dos aliados durante os confrontos.',100,'/media/characters/monnica-de-grimoria-face.png','/media/characters/monnica-de-grimoria-body.png','{"kind":"battle-wins","description":"Vença 5 partidas no modo Batalha rápida. Derrote Monnica de Grimória na Batalha rápida 3 vezes. Derrote Monnica de Grimória na Batalha rápida 1 vez utilizando Anna de Berdal."}','{"unitId":"rival-female-base","description":"Vença 5 partidas no modo Batalha rápida. Derrote Monnica de Grimória na Batalha rápida 3 vezes. Derrote Monnica de Grimória na Batalha rápida 1 vez utilizando Anna de Berdal.","requirements":[{"kind":"battle-wins","mode":"quick","target":5,"description":"Vença 5 partidas no modo Batalha rápida."},{"kind":"battle-wins","mode":"quick","target":3,"description":"Derrote Monnica de Grimória na Batalha rápida 3 vezes.","opponentUnitIds":["rival-female-base"]},{"kind":"battle-wins","mode":"quick","target":1,"description":"Derrote Monnica de Grimória na Batalha rápida 1 vez utilizando Anna de Berdal.","opponentUnitIds":["rival-female-base"],"requiredPlayerUnitIds":["protagonist-female-base"]}],"availableAfterEncounterId":"path-1-encounter-2"}',TRUE,(SELECT COALESCE(MAX(roster_order),-1)+1 FROM units)) ON CONFLICT (id) DO UPDATE SET character_id='rival-female',name='Monnica de Grimória',version='Primeiro encontro',description='Integrante do trio de mercenários rivais. Apoia seus companheiros recuperando a vida dos aliados durante os confrontos.',max_hp=100,portrait_path='/media/characters/monnica-de-grimoria-face.png',illustration_path='/media/characters/monnica-de-grimoria-body.png',unlock_condition='{"kind":"battle-wins","description":"Vença 5 partidas no modo Batalha rápida. Derrote Monnica de Grimória na Batalha rápida 3 vezes. Derrote Monnica de Grimória na Batalha rápida 1 vez utilizando Anna de Berdal."}',unlock_rule='{"unitId":"rival-female-base","description":"Vença 5 partidas no modo Batalha rápida. Derrote Monnica de Grimória na Batalha rápida 3 vezes. Derrote Monnica de Grimória na Batalha rápida 1 vez utilizando Anna de Berdal.","requirements":[{"kind":"battle-wins","mode":"quick","target":5,"description":"Vença 5 partidas no modo Batalha rápida."},{"kind":"battle-wins","mode":"quick","target":3,"description":"Derrote Monnica de Grimória na Batalha rápida 3 vezes.","opponentUnitIds":["rival-female-base"]},{"kind":"battle-wins","mode":"quick","target":1,"description":"Derrote Monnica de Grimória na Batalha rápida 1 vez utilizando Anna de Berdal.","opponentUnitIds":["rival-female-base"],"requiredPlayerUnitIds":["protagonist-female-base"]}],"availableAfterEncounterId":"path-1-encounter-2"}',enabled=TRUE;

DELETE FROM unit_abilities WHERE unit_id='rival-female-base';

INSERT INTO unit_abilities VALUES ('rival-female-base',0,'simple-strike');

INSERT INTO unit_abilities VALUES ('rival-female-base',1,'guard');

INSERT INTO unit_abilities VALUES ('rival-female-base',2,'retain-energy');

INSERT INTO unit_abilities VALUES ('rival-female-base',3,'damage-reflection');

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('characters','rival-female-base',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();
