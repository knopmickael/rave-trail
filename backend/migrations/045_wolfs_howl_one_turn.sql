-- Reduz apenas o bloqueio total do Uivo do lobo. Preserva efeitos adicionais
-- e campos de autoria do CMS; snapshots de partidas existentes não são alterados.
UPDATE abilities SET
  description = CASE WHEN description = 'Causa 20 de dano a um inimigo e impede que ele use qualquer habilidade nos próximos 2 turnos da equipe dele.'
    THEN 'Causa 20 de dano a um inimigo e impede que ele use qualquer habilidade no próximo turno da equipe dele.'
    ELSE description END,
  effects = (SELECT jsonb_agg(CASE WHEN effect->>'kind' = 'ability-block'
    THEN jsonb_set(effect, '{teamTurns}', '1'::jsonb) ELSE effect END ORDER BY position)
    FROM jsonb_array_elements(effects) WITH ORDINALITY AS entries(effect, position))
WHERE id = 'wolfs-howl';
