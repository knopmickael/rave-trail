-- Decisão de produto explícita: a forma final do rival B também é Premium.
-- Não alterar habilidades, atributos, desbloqueios já concedidos ou equipes salvas.
UPDATE units
SET unlock_condition = jsonb_build_object(
  'kind', 'premium',
  'description', 'Unidade premium. Disponível futuramente na loja.'
)
WHERE id IN ('rival-b-final-mode', 'legendary-beast-premium');
