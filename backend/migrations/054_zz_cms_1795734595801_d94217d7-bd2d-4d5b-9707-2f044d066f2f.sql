-- Gerada automaticamente pelo CMS local. Não editar após publicação.
-- A transação e o controle de aplicação são responsabilidade do migrador.

INSERT INTO abilities (id,name,description,energy_cost,target,effects,icon_path) VALUES ('fury-scream','Fúria devastadora','Causa 35 de dano a cada inimigo vivo.',45,'all-enemies','[{"kind":"damage","amount":35}]','/media/abilities/fury-scream.jpg')
          ON CONFLICT (id) DO UPDATE SET name='Fúria devastadora',description='Causa 35 de dano a cada inimigo vivo.',energy_cost=45,target='all-enemies',effects='[{"kind":"damage","amount":35}]',icon_path='/media/abilities/fury-scream.jpg';

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('abilities','fury-scream',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();
