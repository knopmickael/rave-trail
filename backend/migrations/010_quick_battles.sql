-- Batalhas rápidas usam o motor e o histórico existentes, sem vínculo com a campanha.
ALTER TABLE battles ALTER COLUMN encounter_id DROP NOT NULL;
