-- Gerada automaticamente pelo CMS local. Não editar após publicação.
-- A transação e o controle de aplicação são responsabilidade do migrador.

INSERT INTO abilities (id,name,description,energy_cost,target,effects,icon_path) VALUES ('secondary-special','Varredura tática','Causa 20 de dano a cada inimigo vivo.',35,'all-enemies','[{"kind":"damage","amount":20}]','/media/abilities/secondary-special.jpg')
          ON CONFLICT (id) DO UPDATE SET name='Varredura tática',description='Causa 20 de dano a cada inimigo vivo.',energy_cost=35,target='all-enemies',effects='[{"kind":"damage","amount":20}]',icon_path='/media/abilities/secondary-special.jpg';

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('abilities','secondary-special',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();
