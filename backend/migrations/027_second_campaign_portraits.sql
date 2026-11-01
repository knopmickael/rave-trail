-- Os retratos usam as artes de rosto; a ilustração continua apontando para o corpo inteiro.
UPDATE units SET portrait_path = '/media/characters/02/' || id || '-face.png'
WHERE portrait_path = '/media/characters/02/' || id || '.png';
