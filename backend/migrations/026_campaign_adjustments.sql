-- Ártemis passa a usar a mesma modalidade Premium dos demais personagens pagos.
UPDATE units SET unlock_condition = '{"kind":"premium","description":"Personagem premium: US$ 9,90."}'::jsonb
WHERE id = 'maga-artemis';

-- Troca apenas a ordem do catálogo, sem alterar as formações dos encontros.
UPDATE units SET roster_order = NULL WHERE id IN ('combatente-demonio', 'lorde-demonio-rakin');
UPDATE units SET roster_order = CASE id WHEN 'combatente-demonio' THEN 31 ELSE 33 END
WHERE id IN ('combatente-demonio', 'lorde-demonio-rakin');

-- Remove os avisos editoriais dos textos apresentados aos jogadores.
UPDATE units SET description = replace(description, ' História e habilidades provisórias, sujeitas a revisão.', '')
WHERE description LIKE '%História e habilidades provisórias, sujeitas a revisão.%';
UPDATE units SET description = 'Integrante do trio de guerreiros habilidosos encontrado após o confronto com Drak de Pontes.'
WHERE id IN ('guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c');
UPDATE units SET description = 'O verdadeiro poder de Exal de Grimória, o vilão do confronto final da primeira jornada.'
WHERE id = 'rival-b-final-mode';
UPDATE units SET description = 'Uma presença rara que sugere forças muito além das conhecidas no vilarejo.'
WHERE id = 'legendary-beast-premium';
UPDATE campaigns SET description = 'Os heróis procuram a corte de Osiris e enfrentam a ameaça que desperta além das fronteiras.'
WHERE id = 'path-2';
UPDATE encounters SET story = 'No coração do território das trevas, Exal revela seu verdadeiro poder. Ravi de Berdal desperta como Ravi Berserk e avança ao lado de seus companheiros para enfrentar o inimigo. As respostas encontradas na estrada apontam para interesses maiores do que os ataques a um único vilarejo.'
WHERE id = 'path-1-encounter-7';
