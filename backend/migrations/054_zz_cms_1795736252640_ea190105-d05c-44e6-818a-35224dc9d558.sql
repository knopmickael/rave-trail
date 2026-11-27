-- Gerada automaticamente pelo CMS local. Não editar após publicação.
-- A transação e o controle de aplicação são responsabilidade do migrador.

INSERT INTO narrative_characters (id,name) VALUES ('general-abel','General Abel') ON CONFLICT DO NOTHING;

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('narrative','general-abel',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();

INSERT INTO units (id,character_id,name,version,description,max_hp,portrait_path,illustration_path,unlock_condition,unlock_rule,enabled,roster_order)
      VALUES ('general-abel','general-abel','General Abel','Além das Fronteiras','Comandante que protege a fronteira e testa as intenções dos viajantes de Berdal.',100,'/media/characters/02/general-abel-face.png','/media/characters/02/general-abel.png','{"kind":"battle-wins","description":"Vença 100 batalhas na Batalha rápida."}','{"unitId":"general-abel","description":"Vença 100 batalhas na Batalha rápida.","requirements":[{"kind":"battle-wins","mode":"quick","target":100,"description":"Vença 100 batalhas na Batalha rápida."}],"availableAfterEncounterId":"path-2-encounter-1"}',TRUE,(SELECT COALESCE(MAX(roster_order),-1)+1 FROM units)) ON CONFLICT (id) DO UPDATE SET character_id='general-abel',name='General Abel',version='Além das Fronteiras',description='Comandante que protege a fronteira e testa as intenções dos viajantes de Berdal.',max_hp=100,portrait_path='/media/characters/02/general-abel-face.png',illustration_path='/media/characters/02/general-abel.png',unlock_condition='{"kind":"battle-wins","description":"Vença 100 batalhas na Batalha rápida."}',unlock_rule='{"unitId":"general-abel","description":"Vença 100 batalhas na Batalha rápida.","requirements":[{"kind":"battle-wins","mode":"quick","target":100,"description":"Vença 100 batalhas na Batalha rápida."}],"availableAfterEncounterId":"path-2-encounter-1"}',enabled=TRUE;

DELETE FROM unit_abilities WHERE unit_id='general-abel';

INSERT INTO unit_abilities VALUES ('general-abel',0,'simple-strike-ii');

INSERT INTO unit_abilities VALUES ('general-abel',1,'fast-move');

INSERT INTO unit_abilities VALUES ('general-abel',2,'retain-energy-plus');

INSERT INTO unit_abilities VALUES ('general-abel',3,'internal-strength');

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('characters','general-abel',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();
