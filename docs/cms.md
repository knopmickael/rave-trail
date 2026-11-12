# CMS local — Rave Trail Content Studio

O CMS é uma aplicação de autoria em `cms/`, executada somente na sua máquina. A interface usa React/Vite e a API local usa Fastify com PostgreSQL. As gravações são feitas diretamente no banco configurado: ao conectar à produção pelo túnel, salvar no CMS altera o catálogo de produção.

## Iniciar

Requisitos: Node.js 22.12+, dependências do projeto (`npm install`) e cliente OpenSSH. O banco de produção existente já publica PostgreSQL **apenas em `127.0.0.1:5432` na instância**, conforme `deploy/docker-compose.prod.yaml`.

### Escolher o perfil

Os dois arquivos ficam na raiz e são ignorados pelo Git:

| Perfil | Arquivo | Interface | API |
|---|---|---|---|
| Banco local | `.env.cms.local` | `http://127.0.0.1:5188` | `127.0.0.1:3188` |
| Produção/Lightsail | `.env.cms.prod` | `http://127.0.0.1:5189` | `127.0.0.1:3189` |

O arquivo local usa inicialmente a conexão de desenvolvimento do `compose.yaml`. O arquivo de produção precisa ser preenchido com `CMS_DATABASE_URL`, `CMS_SSH_HOST` e o caminho da chave em `CMS_SSH_KEY`, se necessário. O modelo `.env.cms.example` serve de referência para recriar os arquivos; ajuste a conexão, o rótulo e as portas de cada perfil.

O comando de perfil seleciona somente seu respectivo arquivo, sem combinar com `.env.cms` ou com o `.env` do jogo. Variáveis exportadas explicitamente no ambiente do processo mantêm precedência sobre os arquivos. Ambos os perfis podem rodar simultaneamente, nas portas distintas acima. As portas podem ser alteradas por `CMS_WEB_PORT` e `CMS_API_PORT`; reinicie os processos após mudar a configuração.

### Editar o banco local

```powershell
npm run cms:local:db:setup
npm run cms:local
```

Abra **http://127.0.0.1:5188**. Este perfil acessa diretamente o PostgreSQL local, sem SSH. O banco precisa estar iniciado, por exemplo por `npm run db:up`.

### Editar produção/Lightsail

Preencha `.env.cms.prod`, usando a porta local do túnel na URL:

```dotenv
CMS_DATABASE_URL=postgres://usuario:senha@127.0.0.1:5438/rave_trail
CMS_DATABASE_LABEL=Produção · Lightsail
CMS_SSH_HOST=ip-ou-host-da-instancia
CMS_SSH_USER=ubuntu
CMS_SSH_KEY=C:/Users/seu-usuario/.ssh/sua-chave.pem
CMS_SSH_LOCAL_PORT=5438
CMS_SSH_DB_PORT=5432
```

Caracteres especiais da senha precisam de percent-encoding na URL. A chave é um caminho local, sem aspas no valor do `.env`. Abra o túnel em um terminal e mantenha-o aberto:

```powershell
npm run cms:prod:tunnel
```

O comando inicia `ssh -N -T -L 127.0.0.1:5438:127.0.0.1:5432`, com verificação de falha de encaminhamento e keepalive. Usa a verificação normal de host do OpenSSH e permite autenticação pelo agente quando `CMS_SSH_KEY` está vazio. O SSH pode solicitar a confirmação da chave do host na primeira conexão ou a passphrase da chave privada.

Em outro terminal:

```powershell
npm run cms:prod:db:setup
npm run cms:prod
```

Abra **http://127.0.0.1:5189**. A aplicação continua executando localmente; esse perfil muda o banco editado. A API aceita apenas o host local e a origem exata do estúdio. Use `127.0.0.1`, não `localhost`.

Os comandos `*:db:setup` aplicam as migrações pendentes de `backend/migrations/`, com transação e lock. Não executam seed nem resetam jogadores. A migração `038_local_content_cms.sql` adiciona as estruturas do CMS; a `039_cms_content_requirements.sql` sincroniza os mapas e descrições originais, converte desbloqueios legados, explicita a revelação das missões e impede recompensas diretas no banco. Em um banco novo, o catálogo inicial pode ser criado pelo fluxo normal de migração/seed do jogo, apontado para esse banco.

**Compatibilidade:** os comandos anteriores `npm run cms`, `cms:tunnel` e `cms:db:setup` continuam carregando `.env.cms` quando nenhum perfil foi selecionado. Os novos comandos exportam `CMS_PROFILE=local` ou `CMS_PROFILE=prod` para todos os subprocessos, incluindo Vite, API, túnel e migrações.

O indicador de conexão mostra o rótulo configurado, a disponibilidade do banco e a necessidade de migrações. As credenciais nunca são retornadas ao navegador. Se o túnel cair, os formulários exibem erro e permitem tentar novamente após restabelecê-lo.

## Funcionalidades

### Personagens

- Criar, consultar, editar e excluir unidades, com ID estável, personagem narrativo, versão, nome, descrição e HP.
- A lista de personagens tem posições globais e botões **Subir/Descer**, com confirmação. A ordem é salva atomicamente e aparece na Lista de personagens do jogo; o seed preserva a ordenação. Novos personagens entram no fim da lista.
- Rosto e corpo por upload ou caminho/URL. As quatro habilidades devem existir e ser distintas, mantendo a ordem de slots do jogo. Cada slot oferece pesquisa por nome/ID, imagem, descrição, custo, alvo e dados dos efeitos.
- Somente três formas de desbloqueio: **Disponível desde o início**, **Premium** e **Missão com requisitos**. A descrição interna do desbloqueio é gerada automaticamente.
- Missões com múltiplas metas: finalizar um confronto de uma campanha; vencer partidas rápidas/Multiplayer; enfrentar adversários específicos; usar personagens específicos na equipe. Nas listas de adversários/equipe, qualquer um dos selecionados satisfaz a condição.
- Somente missões possuem revelação de requisitos: **Desde o início** ou **Após vencer uma batalha específica de uma campanha**, com seleção de campanha e batalha. Vitórias rápidas/Multiplayer anteriores à revelação não contam para as metas.
- As regras são avaliadas pelo backend do jogo. Novas unidades e regras não dependem de editar os arrays estáticos do catálogo. Personagens já conquistados permanecem desbloqueados quando as regras são alteradas.
- O catálogo completo e as missões da campanha 02 seguem os mesmos fluxos do restante do conteúdo. O cadeado de uma missão informa a batalha de revelação configurada, mesmo quando ela difere dos requisitos da missão.

### Habilidades e IA

Há dois modos de autoria, ambos produzindo o mesmo contrato validado de combate:

1. **Configuração manual:** nome, imagem, descrição, custo de energia, alvo e lista ordenada de efeitos. São oferecidos os 7 alvos e os 11 efeitos existentes: dano, cura, dreno, ressurreição, guarda, recuperação de energia, turno extra, sangramento, invulnerabilidade, bloqueio de ataques e bônus de dano. Valores e combinações de alvo são validados na API.
2. **Assistente de IA:** conversa com histórico e contexto do rascunho. A resposta pode gerar uma configuração nova usando os efeitos suportados. A ação **Aplicar ao formulário** preenche o rascunho; **Salvar alterações** persiste a habilidade.

Configure um provedor compatível com **OpenAI Chat Completions**:

```dotenv
CMS_AI_BASE_URL=https://api.openai.com/v1
CMS_AI_MODEL=nome-do-modelo-disponivel-na-sua-conta
CMS_AI_API_KEY=sua-chave
```

O modelo precisa suportar `response_format: { type: "json_object" }`. Também é possível usar um provedor local compatível, como `CMS_AI_BASE_URL=http://127.0.0.1:11434/v1`, com um modelo instalado e sem chave quando o provedor não a exigir. A API consulta `<BASE_URL>/chat/completions`. Reinicie a API após mudar esses valores.

O contexto enviado ao modelo contém o contrato de efeitos/alvos, o rascunho de habilidade e as mensagens da conversa. Não envia credenciais do banco ou histórico de jogadores. A chave da IA permanece na API local.

A configuração manual é montada diretamente no formulário da habilidade, sem seletores ou salvamento de setups reutilizáveis.

Uma descrição que exige uma mecânica ausente do motor — por exemplo, alvos mistos, condições arbitrárias, passivas ou um atordoamento total — gera uma **especificação de extensão**, exportável como JSON. Não se salva um `kind` desconhecido nem se executa código produzido pelo modelo. A extensão precisa ser implementada e testada no motor compartilhado; depois, o contrato e o formulário podem ser ampliados. Uma combinação nova dos efeitos existentes já pode ser configurada e salva sem alterar o motor.

### Campanhas e confrontos

- Título, descrição, imagem principal do card, fundo do mapa, capítulo, ordem, publicação e confronto necessário para liberar a campanha.
- A seção **01 Metadados** contém os dados de apresentação. O pergaminho do mapa mostra o título e a descrição gravados no CMS, incluindo múltiplos parágrafos e campanhas adicionais.
- Publicar disponibiliza a campanha, respeitando somente o confronto necessário configurado. Não há uma trava adicional implícita para as campanhas 01/02. Despublicar bloqueia mapa e início de novas batalhas no servidor.
- Ambas as campanhas originais usam `/media/campaigns/mapa-campanha-01.png`, com caminho e prévia preenchidos no CMS. Sem fundo personalizado, o jogo usa o mapa padrão.
- Confrontos com ID estável, posição (batalha 1, 2, 3...), título, história, 1–3 adversários e coordenadas no mapa com prévia. Nenhum confronto concede personagem como recompensa direta; o progresso é avaliado pelas missões.
- Ao inserir ou mover uma batalha, os demais confrontos são reordenados na mesma transação. Mudar a ordem preserva os IDs usados no progresso.
- As duas batalhas finais originais têm regras especiais de motor (Ravi/Osiris), que continuam vinculadas a seus IDs. Reordenar não converte essas regras em configurações genéricas.

## Imagens e compatibilidade com o jogo

Uploads aceitam PNG, JPEG e WebP, até 5 MB por imagem. O conteúdo binário fica em `cms_media`, com um caminho imutável `/media/cms/<uuid>`. A API do jogo serve essas imagens publicamente; a API do CMS também as serve para a prévia local. Assim, um upload não depende de copiar arquivos para o contêiner nem de publicar novamente os assets. URLs HTTPS e caminhos de mídia já existentes também são aceitos. Imagens em `/media/` usam a árvore local `frontend/public/` para prévia no estúdio.

**Compatibilidade:** execute a versão atualizada do backend/frontend com as migrações 038 e 039 no mesmo banco usado pelo CMS. Essa atualização é do jogo; o CMS não faz deploy nem é instalado no servidor. Depois dessa atualização, a autoria cotidiana é feita localmente sobre o banco, sem publicar o CMS.

As batalhas já iniciadas conservam seus snapshots de habilidades/unidades. Alterações de catálogo são usadas nas próximas partidas. A interface do jogo pode manter conteúdo em cache durante a sessão; recarregue-a para consultar imediatamente o catálogo atualizado. Conteúdo textual novo aparece no idioma de autoria até receber tradução no sistema de i18n existente.

## Persistência e exclusão

- Abrir um registro para edição, salvar/criar, excluir, descartar alterações, subir/descer personagens, enviar imagens, remover requisitos/efeitos e aplicar propostas de IA exigem confirmação. Cancelar mantém o conteúdo e não dispara a gravação.
- Não existe opção de conteúdo provisório em nenhuma entidade ou contrato do jogo/CMS. Colunas históricas inertes são preservadas apenas para compatibilidade com migrações antigas.
- O seed consulta `cms_content_overrides` e preserva conteúdo editado pelo CMS, relacionamentos e registros excluídos. Uma exclusão não é revertida pelo próximo seed.
- IDs de registros existentes não são alterados pelo formulário.
- Referências são verificadas pelo PostgreSQL e pela API. Conteúdo usado por outros registros, equipes, progresso ou histórico não pode ser removido como se estivesse sem uso. A API explica o impedimento e mantém a transação inteira intacta.
- As permissões do usuário PostgreSQL precisam incluir leitura/escrita nas tabelas de catálogo/CMS e, para `cms:db:setup`, execução das migrações. O servidor local não concede permissões SQL automaticamente.
- `cms/` não participa de `npm run build` nem da imagem de produção. `.env.cms`, `.env.cms.local` e `.env.cms.prod` são ignorados por Git e pelo contexto Docker.

## Comandos e verificação

| Comando | Função |
|---|---|
| `npm run cms:local` | Interface + API com `.env.cms.local` |
| `npm run cms:prod` | Interface + API com `.env.cms.prod` |
| `npm run cms:prod:tunnel` | Túnel SSH com a configuração de produção |
| `npm run cms:local:db:setup` / `npm run cms:prod:db:setup` | Migrações no banco do perfil escolhido |
| `npm run cms` | Interface + API locais |
| `npm run cms:web` / `npm run cms:api` | Processos separados |
| `npm run cms:tunnel` | Túnel SSH para o PostgreSQL remoto |
| `npm run cms:db:setup` | Aplicar migrações no banco do CMS |
| `npm run typecheck` | Inclui a aplicação CMS |
| `npm test` | Inclui contratos, proteção da API local e respostas de IA |
| `npm run test:db` | Inclui CRUD, seed, reordenação, desbloqueios, acesso a campanhas e mídia em banco exclusivo `_test` |

Os testes de banco continuam exigindo `TEST_DATABASE_URL` em um banco exclusivo cujo nome termine em `_test`, diferente do banco do jogo. Não use o banco de produção nesses testes.
