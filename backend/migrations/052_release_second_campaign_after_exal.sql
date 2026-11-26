-- Publica o capítulo 2 para quem já venceu Exal na final do capítulo 1.
-- Não altera progresso, equipes, encontros, autoria narrativa ou snapshots.
UPDATE campaigns
SET released=true, prerequisite_encounter_id='path-1-encounter-7'
WHERE id='path-2'
  AND EXISTS (SELECT 1 FROM encounters WHERE id='path-1-encounter-7');
-- Em um banco vazio a final da campanha 1 ainda será inserida pelo seed;
-- ele completa a publicação e o pré-requisito após criar os encontros.
