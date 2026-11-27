-- Gerada automaticamente pelo CMS local. Não editar após publicação.
-- A transação e o controle de aplicação são responsabilidade do migrador.

INSERT INTO abilities (id,name,description,energy_cost,target,effects,icon_path) VALUES ('divine-protection','Proteção divina','Protege todos os aliados vivos: reduz 10 de dano por golpe durante 3 turnos da equipe e cura 10 HP no início de cada um dos próximos 3 turnos da equipe (30 HP por aliado). Não acumula redução nem cura.',40,'all-allies','[{"kind":"guard","reduction":10,"teamTurns":3,"healPerTurn":10}]','/media/abilities/divine-protection.png')
          ON CONFLICT (id) DO UPDATE SET name='Proteção divina',description='Protege todos os aliados vivos: reduz 10 de dano por golpe durante 3 turnos da equipe e cura 10 HP no início de cada um dos próximos 3 turnos da equipe (30 HP por aliado). Não acumula redução nem cura.',energy_cost=40,target='all-allies',effects='[{"kind":"guard","reduction":10,"teamTurns":3,"healPerTurn":10}]',icon_path='/media/abilities/divine-protection.png';

INSERT INTO cms_content_overrides (entity, id, deleted) VALUES ('abilities','divine-protection',FALSE)
      ON CONFLICT (entity,id) DO UPDATE SET deleted = EXCLUDED.deleted, updated_at = clock_timestamp();
