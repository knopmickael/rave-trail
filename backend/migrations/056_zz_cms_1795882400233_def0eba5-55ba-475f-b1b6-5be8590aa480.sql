-- Gerada automaticamente pelo CMS local. Não editar após publicação.
-- A transação e o controle de aplicação são responsabilidade do migrador.

INSERT INTO abilities (id,name,description,energy_cost,target,effects,icon_path) VALUES ('main-special','Investida','Uma investida física que causa 35 de dano a um inimigo.',30,'enemy','[{"kind":"damage","amount":35}]','/media/abilities/main-special.jpg')
          ON CONFLICT (id) DO UPDATE SET name='Investida',description='Uma investida física que causa 35 de dano a um inimigo.',energy_cost=30,target='enemy',effects='[{"kind":"damage","amount":35}]',icon_path='/media/abilities/main-special.jpg';

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('abilities','main-special',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();
