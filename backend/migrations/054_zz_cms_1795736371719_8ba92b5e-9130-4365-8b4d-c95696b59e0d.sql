-- Gerada automaticamente pelo CMS local. Não editar após publicação.
-- A transação e o controle de aplicação são responsabilidade do migrador.

INSERT INTO narrative_characters (id,name) VALUES ('guardia-da-fronteira','Guardiã da fronteira') ON CONFLICT DO NOTHING;

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('narrative','guardia-da-fronteira',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();

INSERT INTO units (id,character_id,name,version,description,max_hp,portrait_path,illustration_path,unlock_condition,unlock_rule,enabled,roster_order)
      VALUES ('guardia-da-fronteira','guardia-da-fronteira','Guardiã da fronteira','Além das Fronteiras','Sentinela responsável por impedir a passagem de forças hostis ao reino.',100,'/media/characters/02/guardia-da-fronteira-face.png','/media/characters/02/guardia-da-fronteira.png','{"kind":"battle-wins","description":"Vença 100 batalhas na Batalha rápida."}','{"unitId":"guardia-da-fronteira","description":"Vença 100 batalhas na Batalha rápida.","requirements":[{"kind":"battle-wins","mode":"quick","target":100,"description":"Vença 100 batalhas na Batalha rápida."}],"availableAfterEncounterId":"path-2-encounter-1"}',TRUE,(SELECT COALESCE(MAX(roster_order),-1)+1 FROM units)) ON CONFLICT (id) DO UPDATE SET character_id='guardia-da-fronteira',name='Guardiã da fronteira',version='Além das Fronteiras',description='Sentinela responsável por impedir a passagem de forças hostis ao reino.',max_hp=100,portrait_path='/media/characters/02/guardia-da-fronteira-face.png',illustration_path='/media/characters/02/guardia-da-fronteira.png',unlock_condition='{"kind":"battle-wins","description":"Vença 100 batalhas na Batalha rápida."}',unlock_rule='{"unitId":"guardia-da-fronteira","description":"Vença 100 batalhas na Batalha rápida.","requirements":[{"kind":"battle-wins","mode":"quick","target":100,"description":"Vença 100 batalhas na Batalha rápida."}],"availableAfterEncounterId":"path-2-encounter-1"}',enabled=TRUE;

DELETE FROM unit_abilities WHERE unit_id='guardia-da-fronteira';

INSERT INTO unit_abilities VALUES ('guardia-da-fronteira',0,'simple-strike-ii');

INSERT INTO unit_abilities VALUES ('guardia-da-fronteira',1,'guard');

INSERT INTO unit_abilities VALUES ('guardia-da-fronteira',2,'retain-energy-plus');

INSERT INTO unit_abilities VALUES ('guardia-da-fronteira',3,'wolfs-howl');

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('characters','guardia-da-fronteira',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();
