-- Gerada automaticamente pelo CMS local. Não editar após publicação.
-- A transação e o controle de aplicação são responsabilidade do migrador.

INSERT INTO narrative_characters (id,name) VALUES ('saqueador-da-estrada-iii','Saqueador da estrada III') ON CONFLICT DO NOTHING;

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('narrative','saqueador-da-estrada-iii',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();

INSERT INTO units (id,character_id,name,version,description,max_hp,portrait_path,illustration_path,unlock_condition,unlock_rule,enabled,roster_order)
      VALUES ('saqueador-da-estrada-iii','saqueador-da-estrada-iii','Saqueador da estrada III','Reforços da estrada','Saqueador veterano que lidera os reforços na estrada. Protege o grupo e acumula energia para manter a ofensiva.',100,'/media/characters/saqueador-iii-face.png','/media/characters/saqueador-iii.png','{"kind":"battle-wins","description":"Vença 15 partidas no modo Batalha rápida. Derrote Saqueador da estrada III na Batalha rápida 10 vezes."}','{"unitId":"saqueador-da-estrada-iii","description":"Vença 15 partidas no modo Batalha rápida. Derrote Saqueador da estrada III na Batalha rápida 10 vezes.","requirements":[{"kind":"battle-wins","mode":"quick","target":15,"description":"Vença 15 partidas no modo Batalha rápida."},{"kind":"battle-wins","mode":"quick","target":10,"description":"Derrote Saqueador da estrada III na Batalha rápida 10 vezes.","opponentUnitIds":["saqueador-da-estrada-iii"]}],"availableAfterEncounterId":"path-1-encounter-4"}',TRUE,(SELECT COALESCE(MAX(roster_order),-1)+1 FROM units)) ON CONFLICT (id) DO UPDATE SET character_id='saqueador-da-estrada-iii',name='Saqueador da estrada III',version='Reforços da estrada',description='Saqueador veterano que lidera os reforços na estrada. Protege o grupo e acumula energia para manter a ofensiva.',max_hp=100,portrait_path='/media/characters/saqueador-iii-face.png',illustration_path='/media/characters/saqueador-iii.png',unlock_condition='{"kind":"battle-wins","description":"Vença 15 partidas no modo Batalha rápida. Derrote Saqueador da estrada III na Batalha rápida 10 vezes."}',unlock_rule='{"unitId":"saqueador-da-estrada-iii","description":"Vença 15 partidas no modo Batalha rápida. Derrote Saqueador da estrada III na Batalha rápida 10 vezes.","requirements":[{"kind":"battle-wins","mode":"quick","target":15,"description":"Vença 15 partidas no modo Batalha rápida."},{"kind":"battle-wins","mode":"quick","target":10,"description":"Derrote Saqueador da estrada III na Batalha rápida 10 vezes.","opponentUnitIds":["saqueador-da-estrada-iii"]}],"availableAfterEncounterId":"path-1-encounter-4"}',enabled=TRUE;

DELETE FROM unit_abilities WHERE unit_id='saqueador-da-estrada-iii';

INSERT INTO unit_abilities VALUES ('saqueador-da-estrada-iii',0,'simple-strike-ii');

INSERT INTO unit_abilities VALUES ('saqueador-da-estrada-iii',1,'guard');

INSERT INTO unit_abilities VALUES ('saqueador-da-estrada-iii',2,'retain-energy');

INSERT INTO unit_abilities VALUES ('saqueador-da-estrada-iii',3,'female-special');

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('characters','saqueador-da-estrada-iii',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();
