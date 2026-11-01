# Campanha 02 — Além das Fronteiras

**Conteúdo provisório para auditoria:** título, narrativa, habilidades e missões.

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

- A vitória final da Campanha 01 libera a Campanha 02. A migration também libera o capítulo para contas que já completaram os sete encontros anteriores.
- São seis batalhas sequenciais, usando a mesma imagem de mapa da primeira campanha.
- As 17 artes em `frontend/public/media/characters/02/` são usadas no catálogo. Maga Ártemis participa da narrativa da corte e é Premium, por US$ 9,90.
- Todos os novos personagens começam com Golpe simples, Guarda, Reter energia e Golpe forte e 100 HP. Os 16 personagens gratuitos têm a missão **“Vença 100 batalhas na batalha rápida.”** As missões dos adversários são habilitadas ao vencer seus encontros na campanha. Personagens já liberados e Premium sempre têm seus cartões acessíveis.
- Na batalha 6, clicar em **Iniciar batalha** abre o mesmo modal de slots da Lista de personagens, com o fundo escurecido. A escolha do slot inicia a partida com Osiris como aliado convidado, mesmo bloqueado no catálogo. A composição é exclusiva da partida e não altera a equipe salva ou desbloqueia Osiris permanentemente.
- Se Osiris já estiver na equipe salva, ele é movido para o slot escolhido sem duplicação. Slots vazios são aceitos, incluindo uma batalha com apenas Osiris.
- A conta Game Master solicitada é criada diretamente no banco da aplicação; suas credenciais não fazem parte das fontes ou do seed.
- O pergaminho junto ao título abre o prólogo da Campanha 02. Seu texto está em `SECOND_CAMPAIGN_INTRODUCTION`, em `shared/src/content/second-campaign.ts`.
- A final da Campanha 01 mantém a equipe inteira: Ravi de Berdal é convertido em Ravi Berserk no próprio slot ao iniciar a partida, sem conceder a versão permanentemente.
- Combatente Demônio e Lorde demônio Rakin têm suas posições trocadas somente na Lista de personagens; a formação da batalha 5 permanece a mesma.
- Notas editoriais sobre a fase de desenvolvimento não são exibidas aos jogadores.
