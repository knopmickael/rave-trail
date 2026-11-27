-- Gerada automaticamente pelo CMS local. Não editar após publicação.
-- A transação e o controle de aplicação são responsabilidade do migrador.

INSERT INTO narrative_characters (id,name) VALUES ('legendary-beast','Besta Lendária Zéfiro') ON CONFLICT DO NOTHING;

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('narrative','legendary-beast',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();

INSERT INTO units (id,character_id,name,version,description,max_hp,portrait_path,illustration_path,unlock_condition,unlock_rule,enabled,roster_order)
      VALUES ('legendary-beast-premium','legendary-beast','Besta Lendária Zéfiro','Lendária','Uma presença rara que sugere forças muito além das conhecidas no vilarejo.',100,'/media/characters/fera-lendaria-face.png','/media/characters/fera-lendaria-body.png','{"kind":"premium","description":"Personagem premium: US$ 9,90.","priceUsd":9.9}',NULL,TRUE,(SELECT COALESCE(MAX(roster_order),-1)+1 FROM units)) ON CONFLICT (id) DO UPDATE SET character_id='legendary-beast',name='Besta Lendária Zéfiro',version='Lendária',description='Uma presença rara que sugere forças muito além das conhecidas no vilarejo.',max_hp=100,portrait_path='/media/characters/fera-lendaria-face.png',illustration_path='/media/characters/fera-lendaria-body.png',unlock_condition='{"kind":"premium","description":"Personagem premium: US$ 9,90.","priceUsd":9.9}',unlock_rule=NULL,enabled=TRUE;

DELETE FROM unit_abilities WHERE unit_id='legendary-beast-premium';

INSERT INTO unit_abilities VALUES ('legendary-beast-premium',0,'heal-plus');

INSERT INTO unit_abilities VALUES ('legendary-beast-premium',1,'divine-protection');

INSERT INTO unit_abilities VALUES ('legendary-beast-premium',2,'retain-energy-plus');

INSERT INTO unit_abilities VALUES ('legendary-beast-premium',3,'resurrection');

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('characters','legendary-beast-premium',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();
