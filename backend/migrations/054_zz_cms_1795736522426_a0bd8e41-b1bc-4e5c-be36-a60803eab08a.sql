-- Gerada automaticamente pelo CMS local. Não editar após publicação.
-- A transação e o controle de aplicação são responsabilidade do migrador.

INSERT INTO narrative_characters (id,name) VALUES ('samurai-erlang','Samurai Erlang') ON CONFLICT DO NOTHING;

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('narrative','samurai-erlang',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();

INSERT INTO units (id,character_id,name,version,description,max_hp,portrait_path,illustration_path,unlock_condition,unlock_rule,enabled,roster_order)
      VALUES ('samurai-erlang','samurai-erlang','Samurai Erlang','Além das Fronteiras','Espadachim disciplinado que serve ao comando da fronteira.',100,'/media/characters/02/samurai-erlang-face.png','/media/characters/02/samurai-erlang.png','{"kind":"battle-wins","description":"Vença 100 batalhas na Batalha rápida."}','{"unitId":"samurai-erlang","description":"Vença 100 batalhas na Batalha rápida.","requirements":[{"kind":"battle-wins","mode":"quick","target":100,"description":"Vença 100 batalhas na Batalha rápida."}],"availableAfterEncounterId":"path-2-encounter-1"}',TRUE,(SELECT COALESCE(MAX(roster_order),-1)+1 FROM units)) ON CONFLICT (id) DO UPDATE SET character_id='samurai-erlang',name='Samurai Erlang',version='Além das Fronteiras',description='Espadachim disciplinado que serve ao comando da fronteira.',max_hp=100,portrait_path='/media/characters/02/samurai-erlang-face.png',illustration_path='/media/characters/02/samurai-erlang.png',unlock_condition='{"kind":"battle-wins","description":"Vença 100 batalhas na Batalha rápida."}',unlock_rule='{"unitId":"samurai-erlang","description":"Vença 100 batalhas na Batalha rápida.","requirements":[{"kind":"battle-wins","mode":"quick","target":100,"description":"Vença 100 batalhas na Batalha rápida."}],"availableAfterEncounterId":"path-2-encounter-1"}',enabled=TRUE;

DELETE FROM unit_abilities WHERE unit_id='samurai-erlang';

INSERT INTO unit_abilities VALUES ('samurai-erlang',0,'simple-strike-ii');

INSERT INTO unit_abilities VALUES ('samurai-erlang',1,'guard');

INSERT INTO unit_abilities VALUES ('samurai-erlang',2,'retain-energy-plus');

INSERT INTO unit_abilities VALUES ('samurai-erlang',3,'quick-slash');

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('characters','samurai-erlang',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();
