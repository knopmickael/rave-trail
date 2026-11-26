# Campanha 02 — Além das Fronteiras

Título, narrativa, habilidades e missões são editáveis pelo CMS.

## Contexto

Depois do confronto com Exal, Ravi, Doko e Anna seguem pistas para além de Berdal. Os ataques às rotas comerciais parecem ligados à corrupção de antigos selos. A investigação leva os três ao reino de Osiris, onde uma ameaça demoníaca começa a despertar.

## Confrontos

1. **Os guardiões da fronteira:** General Abel, Guardiã da fronteira e Samurai Erlang testam as intenções dos viajantes antes de permitir sua passagem para a corte.
2. **A prova da corte:** Sábio do castelo, Emissário do castelo e Grande rei Osiris avaliam os heróis. Depois da prova, Maga Ártemis compartilha registros sobre os santuários esquecidos.
3. **O caminho dos santuários:** Espadachim Lupus, Feiticeira Ravina e Monge Omero guardam os segredos dos antigos selos e exigem uma demonstração de preparo.
4. **As três bestas ancestrais:** a corrupção desperta Ravok, Fenrir e Enkei. Superá-las abre a passagem para o território demoníaco.
5. **A vanguarda de Rakin:** Lorde demônio Rakin, Mago demônio e Combatente Demônio preparam a invasão. A energia por trás deles revela um inimigo ainda maior.
6. **O verdadeiro rei demônio:** Osiris se junta à equipe para enfrentar a entidade que procurava isolar os reinos e romper os selos. Os heróis tentam fechar a passagem e impedir a invasão.

Os textos completos exibidos no jogo estão em `shared/src/content/encounters.ts`, nos registros `path-2-encounter-1` a `path-2-encounter-6`. Os nomes e descrições dos personagens estão em `shared/src/content/second-campaign.ts`.

## Regras implementadas

- A Campanha 02 é publicada com o pré-requisito **vencer a batalha 7 da Campanha 01**, `path-1-encounter-7`. A vitória salva libera a seleção, o mapa e a primeira batalha, inclusive para contas que já tinham concluído a Campanha 01 antes da atualização. Publicação e pré-requisito continuam editáveis pelo CMS.
- São seis batalhas sequenciais, com o mapa próprio `frontend/public/media/campaigns/mapa-campanha-02.png`, configurado pela migration `053_second_campaign_map_background.sql`.
- As 17 artes em `frontend/public/media/characters/02/` são usadas no catálogo. Maga Ártemis participa da narrativa da corte e é Premium, por US$ 9,90.
- Os 17 personagens da Campanha 02 só aparecem na **Lista de personagens** após a vitória salva em `path-1-encounter-7`. O **Quadro de missões** usa a mesma condição para revelar as 16 missões gratuitas; personagens Premium continuam fora do quadro. A posse antecipada não antecipa essa revelação, e a vitória não concede personagens automaticamente. Enquanto o progresso carrega, o elenco da segunda campanha permanece oculto.
- Todos os novos personagens começam com Golpe simples, Guarda, Reter energia e Golpe forte e 100 HP. Os 16 personagens gratuitos têm a missão **“Vença 100 batalhas na batalha rápida.”** As missões dos adversários são habilitadas ao vencer seus encontros na campanha. Dentro do elenco já revelado, personagens conquistados e Premium mantêm seus cartões acessíveis.
- Na batalha 6, clicar em **Iniciar batalha** abre o mesmo modal de slots da Lista de personagens, com o fundo escurecido. A escolha do slot inicia a partida com Osiris como aliado convidado, mesmo bloqueado no catálogo. A composição é exclusiva da partida e não altera a equipe salva ou desbloqueia Osiris permanentemente.
- Se Osiris já estiver na equipe salva, ele é movido para o slot escolhido sem duplicação. Slots vazios são aceitos, incluindo uma batalha com apenas Osiris.
- A conta Game Master solicitada é criada diretamente no banco da aplicação; suas credenciais não fazem parte das fontes ou do seed.
- O pergaminho junto ao título usa a descrição da campanha salva no CMS. O texto inicial vem de `SECOND_CAMPAIGN_INTRODUCTION`, em `shared/src/content/second-campaign.ts`.
- A final da Campanha 01 mantém a equipe inteira: Ravi de Berdal é convertido em Ravi Berserk no próprio slot ao iniciar a partida, sem conceder a versão permanentemente.
- Combatente Demônio e Lorde demônio Rakin têm suas posições trocadas somente na Lista de personagens; a formação da batalha 5 permanece a mesma.
- Notas editoriais sobre a fase de desenvolvimento não são exibidas aos jogadores.

## Reativação do elenco - migration 050

A migration `050_enable_second_campaign_characters.sql` reabilita os 17 personagens da campanha 2 (`units.enabled=true`) e restaura as formações originais dos encontros `path-2-encounter-1` a `path-2-encounter-6` somente quando o encontro ficou vazio após a migration 040; autoria não vazia do CMS é preservada. Nenhuma unidade é concedida à conta: progresso, equipes, missões e preços não mudam, e a publicação da campanha continua seguindo o CMS. O seed insere novas unidades sempre habilitadas e não volta a desabilitar o elenco reativado, respeitando desativações posteriores pelo CMS.

## Liberação após Exal - migration 052

A reativação do elenco na migration 050 não publicava a campanha. A migration `052_release_second_campaign_after_exal.sql` altera somente `released=true` e `prerequisite_encounter_id='path-1-encounter-7'` da campanha `path-2`. Não reescreve progresso, equipes, batalhas ou textos de autoria. Contas novas e contas que venceram apenas as seis primeiras batalhas continuam bloqueadas. O seed preserva posteriores ajustes de publicação e pré-requisito pelo CMS.

Em bancos vazios, os encontros da Campanha 01 são criados pelo seed, depois das migrations. Nesse caso, o seed completa o pré-requisito somente após inserir a batalha 7, respeitando a chave estrangeira e os registros já gerenciados pelo CMS.
