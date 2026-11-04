# RAVE TRAIL — Especificação para implementação do MVP

Estrutura atual do código: [architecture.md](architecture.md). As seções datadas abaixo preservam o histórico das decisões de produto.

**Revisão oficial: 2026-10-29.** MVP full-stack com PostgreSQL e autenticação por e-mail/senha. Esta revisão incorpora as decisões aprovadas sobre energia, MISS e turnos extras. Backlog executivo: `implementation_tasks.md`. Decisões técnicas: `docs/decisions.md`.

## Atualização de 2026-10-30 — tarefas atuais 01–04

As definições abaixo substituem as regras anteriores conflitantes deste documento. Detalhamento atualizado em `todo-list.md`, `README.md` e no registro de decisões:

- Sessão absoluta de **uma hora** após cadastro/login, sem extensão por atividade. Nome editável no modal do perfil e persistido por conta.
- Campanha 1, na ordem: saqueadores; Jung/Exal/Monnica; Drak/Curandeiro/Curandeira; Trinity/Vlade/Passago; Jung/Exal/Monnica; Jung/Exal; Exal — Verdadeiro poder. As composições estão aprovadas e mantêm essa ordem nos slots.
- A última batalha exige Ravi de Berdal base escalado e é um duelo 1×1. Só Ravi entra; é substituído por Ravi Berserk no início de seu segundo turno, após a primeira rodada adversária, preservando o HP proporcional e os efeitos. Transformar-se nessa partida não concede o desbloqueio permanente nem modifica os slots salvos. As regras de Missões continuam sendo a fonte do desbloqueio.
- Batalhas 1–6 usam a clareira e `fight.ogg`; a final usa `evil-fight-background.png` e `final-fight.mp3`. Botões usam os sons de menu/batalha fornecidos, com efeitos de mudança oficial de turno e personagem derrotado, todos sujeitos ao volume/silêncio global.

## 1. Papel do agente

Você é um engenheiro de software sênior especializado em desenvolvimento de jogos web 2D, arquitetura full-stack, TypeScript, React, Node.js, PostgreSQL, sistemas de combate por turnos e interfaces de jogos JRPG.

Sua missão é implementar do zero o jogo **Rave Trail**, um JRPG 2D de navegador com batalhas estratégicas 3v3, progressão narrativa, personagens desbloqueáveis e arquitetura preparada para multiplayer futuro.

**Não entregue apenas telas estáticas ou componentes demonstrativos. Implemente um jogo funcional, navegável, testável e persistente.**

Trabalhe de maneira autônoma, tomando decisões técnicas fundamentadas quando necessário, sem alterar as regras de negócio estabelecidas.

Antes de começar, inspecione o repositório e os assets existentes. Preserve o trabalho já realizado.

---

# 2. Visão geral do produto

**Nome:** Rave Trail

**Plataforma:** Navegadores modernos, prioritariamente desktop.

**Gênero:** JRPG 2D, aventura narrativa e combate estratégico por turnos.

**Direção visual:** Anime ilustrado, com cores vivas, personagens originais e cenários pintados digitalmente.

**Referências conceituais:**
- Naruto Arena: organização visual e mecânica de batalhas em equipes.
- Hunter × Hunter: exploração, personagens inicialmente inocentes e progressão gradual de poderes.
- JRPGs clássicos: campanhas, jornadas, desbloqueios e narrativa.

As referências servem exclusivamente como inspiração. Não utilizar personagens, nomes, logos, músicas ou assets protegidos dessas franquias.

O jogo terá universo, personagens e identidade próprios.

## Objetivos do MVP

Implementar:

1. Tela inicial.
2. Menu principal.
3. Lista de personagens.
4. Seleção de equipe.
5. Seleção de campanha extensível, com dois capítulos cadastrados inicialmente e somente o primeiro disponível.
6. Sete combates no primeiro caminho.
7. Sistema de combate 3v3 por turnos.
8. Inteligência artificial adversária.
9. Habilidades e efeitos de status.
10. Desbloqueio de personagens.
11. Loja demonstrativa.
12. Configurações de áudio.
13. Persistência por conta em PostgreSQL no servidor.
14. Estrutura extensível para multiplayer futuro.
15. Cadastro, login e logout por e-mail e senha, sem confirmação por e-mail ou login social nesta versão.

O MVP requer conexão com o backend para autenticação, acesso ao progresso e partidas oficiais contra a IA. Não utilizar banco de dados no navegador como fonte de verdade.

---

# 3. Stack tecnológica

Stack definida:

- React + TypeScript + Vite.
- HTML e CSS para menus e interfaces.
- CSS animations/transitions para efeitos simples.
- Game Core determinístico, compartilhável e independente da camada visual e do banco.
- Zustand ou Context API para estado da interface.
- Node.js + TypeScript + Fastify para a API HTTP.
- PostgreSQL para contas, sessões, progresso e estado oficial das batalhas.
- `pg` com SQL parametrizado e migrações SQL versionadas.
- Zod para validação das entradas da API.
- Sessões opacas mantidas no servidor e cookie HttpOnly no navegador.
- Vitest para testes automatizados.
- Testing Library e jsdom para os fluxos críticos da interface.
- Docker Compose para PostgreSQL no desenvolvimento.

Frontend e API devem compartilhar a mesma origem. No desenvolvimento, o Vite encaminha `/api` ao Fastify; em produção, o Fastify pode servir o build do frontend atrás de HTTPS.

**Não introduza Phaser, PixiJS ou outro motor gráfico sem necessidade demonstrável.**

O jogo possui combates por turnos e personagens representados por ilustrações 2D. Priorize HTML, CSS e JavaScript para movimentações, transições, efeitos e organização da interface.

Se uma biblioteca de animação for realmente necessária, justifique sua escolha.

Organize a aplicação em módulos independentes:

- `core`: regras puras de combate.
- `content`: personagens, habilidades, inimigos e campanha.
- `features`: funcionalidades e fluxos.
- `components`: componentes visuais reutilizáveis.
- `assets`: recursos gráficos e sonoros.
- `shared`: contratos serializáveis entre cliente e servidor.
- `server`: HTTP, autenticação, serviços de aplicação e autorização.
- `server/db`: repositórios PostgreSQL e migrações.

Estrutura inicial: `src/` para a aplicação React, `server/` para a API e `shared/` para contratos. `core` e `content` deverão ser módulos TypeScript compartilháveis, utilizados pela previsão no cliente e pela resolução oficial no servidor.

O Game Core não deve depender de React, CSS, DOM, APIs do navegador, Fastify ou PostgreSQL. Persistência e transporte devem adaptar os resultados do core sem misturar SQL ou HTTP às regras.

---

# 4. Assets existentes

O usuário já possui um pacote inicial de assets gerados para o jogo.

Inspecione os arquivos fornecidos antes de criar substituições.

Arquivos esperados, caso preservados com os nomes originais:

- `logo-rave-trail.png`
- `sky-background.webp`
- `index.html`
- `styles.css`
- `app.js`

Também existe uma imagem de background de batalha representando um campo aberto entre florestas.

Localize e utilize esses recursos caso estejam disponíveis no projeto.

**Não considere obrigatório recriar os assets já fornecidos.**

Caso algum recurso esteja ausente, utilize um placeholder visual identificado, sem bloquear a implementação.

Placeholder significa recurso temporário utilizado até que a arte definitiva esteja disponível.

## Requisitos de integração

- Logo independente do fundo.
- Background independente dos componentes interativos.
- Botões HTML estilizados por CSS.
- Layout responsivo.
- Imagens carregadas por caminhos configuráveis.
- Sem textos incorporados às imagens dos botões.
- Estados visuais normal, hover, pressed, disabled e focus.

---

# 5. Identidade visual

## Estilo

Anime Adventure Fantasy.

Características:

- Ilustrações 2D.
- Cel shading, sombreamento com áreas de cores bem definidas.
- Cenários naturais.
- Texturas leves de madeira e pergaminho.
- Ornamentos dourados discretos.
- Interface legível e organizada.

## Paleta inicial

- Verde floresta: `#233B38`
- Madeira: `#9A7651`
- Pergaminho: `#E8D6AD`
- Dourado: `#D4A64D`
- Azul energia: `#497DB4`

### Tipografia e botões

- Usar tipografia moderna sem serifa em toda a interface: Segoe UI Variable/Segoe UI, com fallback para fontes de sistema sans-serif.
- Botões e destaques de seleção devem usar tons alaranjados inspirados no logo: laranja principal `#F58220`, laranja intenso `#CF5711` e variações claras para hover.
- Manter texto escuro legível sobre os botões, bordas arredondadas e estados normal, hover, pressed, disabled e focus.
- Centralizar fontes e cores em variáveis CSS para manter consistência entre início, autenticação, menu, perfil e personagens.

## Tela inicial

A tela inicial deve possuir:

- Background exclusivamente de céu azul com nuvens brancas.
- Logo Rave Trail centralizado, em tons de laranja e dourado.
- Botão "Começar jogo" abaixo do logo.
- Visual limpo, sem personagens.
- Animações discretas de entrada e interação.

O céu compartilhado deve possuir animação suave de nuvens flutuando, utilizando WebM em loop, sem áudio, derivado do fundo existente. Manter a imagem original como fallback. A instância do fundo permanece montada durante a navegação entre tela inicial, autenticação, menu, lista de personagens e seleção de campanha, sem reiniciar o loop a cada troca. Pausar reprodução em aba oculta e respeitar `prefers-reduced-motion` sem carregar vídeo quando a preferência já estiver ativa. Falha de reprodução não deve bloquear a interface. A seleção de campanha usa exatamente o mesmo céu do menu e da lista, sem cenário próprio ou sobreposição.

O botão deve ser um elemento HTML real, não parte do background.

Ao clicar em "Começar jogo", verificar a sessão. Sem sessão válida, apresentar login/cadastro. Após autenticação, abrir o menu principal. Uma sessão existente permite continuar sem digitar a senha novamente.

## Menu principal

Opções:

1. Campanha
2. Lista de personagens
3. Multiplayer
4. Loja
5. Configurações

Multiplayer deve aparecer desabilitado. Os itens do menu exibem somente seus nomes, sem setas ou textos auxiliares como "Em breve" e "Em desenvolvimento".

### Layout do menu principal e perfil

- Exibir o logo do jogo acima da lista de itens do menu principal, alinhado ao grupo no canto superior esquerdo.
- Fixar os itens do menu no canto superior esquerdo, diretamente sobre o cenário, sem painel ou div visual envolvendo o conjunto dos botões.
- Não exibir o link "Voltar ao início"; o retorno à tela inicial ocorre ao desconectar da conta.
- Fixar um cartão branco de perfil no canto inferior direito, com foto à esquerda e nickname/e-mail à direita.
- Por enquanto, usar foto e nickname provisórios; o e-mail vem da conta autenticada. Upload de foto e edição de nickname serão implementados futuramente.
- Somente ao clicar no cartão, abrir um modal com os detalhes do usuário e o botão "Desconectar".
- Permitir fechar o modal sem desconectar; desconexão bem-sucedida revoga a sessão e retorna à tela inicial. Se a requisição falhar, manter o perfil aberto com feedback e opção de tentar novamente.
- Garantir acesso por teclado e layout utilizável em telas menores.

## Configurações

Implementar inicialmente apenas:

- Toggle de áudio ligado/desligado.

Persistir a preferência na conta do jogador no PostgreSQL, por endpoint autenticado.

## Autenticação

- Cadastro apenas com e-mail e senha.
- Sem confirmação por e-mail nesta versão.
- Sem login com Google, GitHub ou outros provedores.
- E-mail único, normalizado com remoção de espaços externos e conversão para minúsculas.
- Senha de 10 a 128 caracteres; não remover espaços nem armazenar a senha em texto puro.
- Hash de senha com scrypt e salt individual, verificado com comparação de tempo constante.
- Cadastro cria conta, progresso inicial e sessão em uma única transação.
- Login retorna mensagem genérica para e-mail inexistente ou senha incorreta.
- Sessão opaca aleatória de 256 bits, válida por sete dias; armazenar somente o hash do token no PostgreSQL.
- Cookie HttpOnly, SameSite=Lax, host-only e Secure em produção; nenhum token em localStorage, sessionStorage ou IndexedDB.
- Login substitui e revoga a sessão anterior apresentada pelo navegador; logout revoga a sessão atual no banco e remove o cookie.
- Validar expiração em cada acesso autenticado; reiniciar a API não deve perder sessões válidas.
- Verificar a origem das requisições que alteram estado e limitar tentativas de cadastro/login.
- Autorizar dados sempre pela identidade da sessão, nunca por um userId arbitrário enviado pelo cliente.
- Cadastro e login devem exibir estados de envio, erro e sucesso e evitar submissões repetidas durante uma requisição.

Endpoints iniciais: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` e `GET /api/progress`.

---

# 6. Universo narrativo

O jogo acontece em um continente relativamente místico.

Existem indivíduos capazes de desenvolver habilidades extraordinárias, incluindo manipulação de energia, técnicas marciais avançadas, poderes elementais e espirituais.

Entretanto, no início da história, esses poderes são raros e pouco compreendidos.

A progressão deve ocorrer gradualmente.

Não introduzir imediatamente criaturas fantásticas comuns, monstros espalhados pelo mapa ou magia excessiva.

## Premissa

Três jovens camponeses vivem em um vilarejo comercialmente estratégico.

O vilarejo conecta rotas comerciais importantes do continente.

Um grupo organizado de combatentes poderosos ataca a região e destrói estruturas essenciais para o comércio.

A economia local entra em colapso.

Com a redução de recursos, a guarda responsável pela defesa do vilarejo perde integrantes.

Os três jovens protagonistas ingressam na guarda para fortalecer a defesa da comunidade.

Seguindo ordens de um comandante experiente, partem em uma jornada de reconhecimento pelo continente.

Sua missão é investigar a crescente tensão regional e compreender as motivações por trás dos ataques.

Durante a viagem encontram saqueadores, mercenários, combatentes habilidosos e indivíduos com poderes extraordinários.

A narrativa deve desenvolver gradualmente uma conspiração envolvendo o controle econômico e político das rotas comerciais.

---

# 7. Protagonistas

Criar três protagonistas originais.

Nomes aprovados: protagonista principal **Ravi de Berdal**, protagonista secundário de defesa em equipe **Doko de Berdal** e protagonista feminina de ataque AOE **Anna de Berdal**. Manter identificadores internos estáveis, independentes dos nomes de exibição.

## Protagonista principal

- Masculino.
- Jovem camponês.
- Otimista, inocente e impulsivo.
- Potencial extraordinário ainda desconhecido.
- Inicialmente utiliza técnicas físicas simples.
- Possuirá uma transformação desbloqueável durante a campanha.

## Protagonista secundário

- Masculino.
- Idade semelhante à do protagonista principal.
- Reservado, estratégico e disciplinado.
- Inspiração conceitual em combatentes técnicos.
- Futuramente poderá desenvolver técnicas mais complexas.

## Protagonista feminina

- Feminina.
- Idade semelhante à dos demais.
- Inteligente, pragmática e corajosa.
- Talento natural para defesa, suporte e percepção de energia.

Os três devem ser visualmente distintos, mantendo a mesma linguagem artística.

---

# 8. Modelo de personagens

Existe uma distinção obrigatória entre:

**Personagem narrativo:** indivíduo existente no universo do jogo.

**Unidade jogável:** versão específica daquele indivíduo, com aparência, atributos e habilidades próprios.

Exemplo:

- John Young
- John Teen
- John Adult

Essas três versões são unidades independentes.

## Regra fundamental

**As habilidades de uma unidade são imutáveis.**

Se um personagem narrativo reaparecer posteriormente com habilidades diferentes, deverá ser criada uma NOVA unidade jogável.

Não substituir silenciosamente habilidades de unidades existentes.

Cada unidade deve possuir:

- ID único.
- ID do personagem narrativo.
- Nome.
- Versão.
- Retrato.
- Ilustração de combate.
- HP máximo.
- Exatamente quatro habilidades.
- Condição de desbloqueio.
- Metadados narrativos.

## Inimigos também são unidades jogáveis

Todas as unidades utilizadas pela IA devem ser definidas no mesmo catálogo das unidades controladas pelo jogador.

Isso permitirá que qualquer inimigo seja futuramente desbloqueado e selecionado.

A disponibilidade é controlada separadamente da definição da unidade.

Não duplicar definições para versões controladas por jogador e IA.

---

# 9. Personagens disponíveis

Inicialmente, três unidades estarão liberadas:

1. Ravi de Berdal — protagonista principal.
2. Doko de Berdal — protagonista secundário, suporte/defesa.
3. Anna de Berdal — protagonista feminina, especial AOE.

Capitão da guarda Kalis e Capitão da guarda Ridan são aliados que exigem três vitórias rápidas na Tabela de missões para serem desbloqueados. Eles não aparecem como adversários na Batalha rápida enquanto não forem desbloqueados. Eles não possuem missão de campanha contra si.

As demais unidades do catálogo estarão inicialmente bloqueadas, incluindo:

4. Drak de Pontes — chefão, desbloqueado ao vencer o combate 4 da jornada 1.
5. Ravi Berserk — unidade independente da transformação de Ravi, desbloqueada ao vencer o combate 6.
6. Besta Lendária — unidade premium, disponível futuramente na loja.
7. Exal - Verdadeiro poder (`rival-b-final-mode`) — unidade Premium, assim como a Besta Lendária, disponível futuramente na loja.

Saqueadores, rivais, curandeiros, Jung de Grimória II e guerreiros habilidosos também aparecem na lista completa, com bloqueios conforme o progresso. Adicionar unidades ao catálogo não concede desbloqueios automaticamente. As unidades da campanha 02 permanecem ocultas da Lista e da Tabela de missões. As unidades premium Exal - Verdadeiro poder e Besta Lendária não aparecem na Tabela de missões.

## Nomes e ordem aprovados da Lista de personagens

Exibir da esquerda para a direita, linha a linha, nesta sequência:

1. Ravi de Berdal.
2. Doko de Berdal.
3. Anna de Berdal.
4. Capitão da guarda Kalis.
5. Capitão da guarda Ridan.
6. Saqueador da estrada I.
7. Saqueador da estrada II.
8. Saqueadora da estrada.
9. Jung de Grimória (`rival-a-base`).
10. Exal de Grimória (`rival-b-base`).
11. Monnica de Grimória (`rival-female-base`).
12. Curandeiro de Pontes (`guardian-healer-male-base`).
13. Curandeira de Pontes (`guardian-healer-female-base`).
14. Drak de Pontes.
15. Trinity de Espinea (`guerreiros-habilidosos-a`).
16. Vlade de Espinea (`guerreiros-habilidosos-b`).
17. Passago de Espinea (`guerreiros-habilidosos-c`).
18. Jung de Grimória II (`jung-de-grimoria-ii`).
19. Ravi Berserk.
20. Exal - Verdadeiro poder (`rival-b-final-mode`).
21. Besta Lendária.

Os novos nomes substituem os rótulos anteriores dos rivais, curandeiros e guerreiros. Preservar IDs, identidades narrativas, caminhos das imagens, atributos, habilidades, desbloqueios e equipe; apenas nomes/apresentação e ordem são remapeados.

A Besta Lendária poderá aparecer brevemente durante a campanha, sem interagir diretamente com os protagonistas.

Ela representa a existência de forças muito superiores às conhecidas pelos habitantes do vilarejo.

## Loja

Implementar interface para exibir unidades premium.

No MVP, não processar pagamentos reais nem conceder acesso premium por uma compra fictícia apresentada como real.

Exibir o personagem com a arte original, sem cadeado, e o botão de compra desabilitado; unidades já presentes em `unlockedUnitIds` mostram "Personagem adquirido".

Preparar interfaces de serviço no backend para integração futura com provedor de pagamentos.

---

# 10. Regras do combate

## Formato

- Combate por turnos.
- Equipes com uma a três unidades; impedir iniciar com equipe vazia.
- Cada unidade possui 100 HP inicialmente.
- Cada batalha reinicia as unidades com HP cheio e as reservas de energia com o valor inicial definido abaixo; recursos não são transportados entre encontros.
- O jogador inicia a batalha.
- Uma unidade derrotada não executa ações.
- Vitória quando todas as unidades adversárias forem derrotadas.
- Derrota quando todas as unidades do jogador forem derrotadas.

## Energia

Cada equipe possui uma reserva própria de energia compartilhada.

Regras:

- Energia máxima: 100.
- Regeneração: +15 ao iniciar cada novo turno da equipe, inclusive turnos extras.
- Reserva inicial: 0 antes da regeneração. A primeira equipe começa seu primeiro turno com 15; a outra recebe sua regeneração ao iniciar seu próprio primeiro turno.
- Energia não pode ultrapassar 100.
- Energia não pode ficar negativa.
- Habilidades consomem ou recuperam energia compartilhada.

A energia é independente do HP.

## Ações

Cada personagem vivo pode executar no máximo uma habilidade por turno.

É permitido confirmar uma fila vazia para passar o turno.

O jogador pode selecionar habilidades de diferentes personagens e organizar a ordem de execução.

Ações devem ser executadas sequencialmente.

## Fila de ações

Exemplo:

Equipe começa com 40 de energia.

1. Personagem A executa Golpe simples: -15.
2. Energia restante: 25.
3. Personagem C executa Reter energia: +15.
4. Energia disponível: 40.
5. Personagem B executa Especial de 40.

O sistema deve permitir esse tipo de combinação.

A validade energética deve considerar a sequência completa da fila, e não apenas o saldo antes do início da execução.

A interface deve apresentar uma prévia do consumo e recuperação de energia, reutilizando as mesmas regras puras validadas pelo servidor.

Ao selecionar uma habilidade, adicioná-la ao final da fila do macro/combo atual e refletir seu custo imediatamente na barra de energia. O débito durante o planejamento representa a previsão da fila; a confirmação não pode cobrar o mesmo custo duas vezes.

Ao clicar novamente na habilidade enfileirada, removê-la da fila. As ações seguintes avançam, preservando sua ordem relativa. Recalcular a previsão em todas as remoções e reordenações, considerando recuperações intermediárias e o teto de 100.

A montagem da fila é editável na interface. A confirmação envia comandos ao servidor, que valida a equipe, a versão do turno, as habilidades, os alvos e a sequência energética antes da resolução oficial.

Cada ação deve possuir alvo válido quando necessário.

Ataques direcionados a uma unidade viva durante o planejamento, mas derrotada por uma ação anterior do próprio combo, são executados como **MISS**. Consomem integralmente a energia da habilidade e a ação do personagem. Não cancelar, reembolsar ou redirecionar automaticamente esses ataques. O jogador é responsável por calcular o dano e distribuir seus alvos.

Não permitir escolher um alvo já derrotado ao montar a ação. Um personagem derrotado não executa ações. A batalha termina quando a condição de vitória ou derrota é atingida; não executar ações restantes após o encerramento.

Outros casos de alvo inválido, como suporte a um aliado que deixou de estar vivo, devem ter política explícita antes de introduzir habilidades que tornem esse cenário possível. Não aplicar automaticamente a esses casos a regra de MISS definida para ataques.

### Detalhes do planejador ainda sujeitos a confirmação

As propostas abaixo não são regras aprovadas:

- Refletir também a recuperação de Reter energia imediatamente na barra prevista ao enfileirar a habilidade, respeitando sua posição na sequência.
- Se uma remoção ou reordenação deixar a fila sem energia suficiente, preservar as ações visíveis, sinalizar o erro e impedir a confirmação até o ajuste.

---

# 11. Habilidades comuns

## Golpe simples

- Custo: 15 de energia.
- Alvo: um inimigo.
- Efeito: 20 de dano ao HP.

## Guarda

- Custo: 10 de energia.
- Alvo: uma unidade aliada, incluindo o próprio usuário.
- Efeito: reduz 10 pontos de dano de CADA golpe recebido enquanto estiver ativa.
- Duração: dois turnos da equipe protegida, conforme ciclo de turnos.

Não é um escudo consumível.

Exemplo:

Três ataques de 20 contra uma unidade protegida causam 10 de dano cada.

Dano total recebido: 30.

A proteção deve expirar quando a equipe protegida voltar a agir pela segunda vez após sua aplicação, respeitando a sequência de turnos.

A expiração ocorre no início dessa segunda oportunidade de agir. Turnos extras contam como turnos da equipe protegida. Múltiplas aplicações de Guarda, incluindo a versão AOE, não somam a redução: ela permanece em 10 por golpe, e uma reaplicação renova a duração.

## Reter energia

- Custo: 0.
- Efeito: +15 de energia para a equipe.
- Limite máximo: 100.

## Golpe forte

- Custo: 25.
- Alvo: um inimigo.
- Efeito: 30 de dano.

## Recuperar vida

- Custo: 35.
- Alvo: um aliado vivo.
- Efeito: restaura 20 HP.
- Não ultrapassa o HP máximo.

---

# 12. Especiais dos protagonistas

Todos os protagonistas possuem:

1. Golpe simples.
2. Guarda.
3. Reter energia.
4. Especial próprio.

## Protagonista principal

Especial:

- Custo: 25.
- Alvo: um inimigo.
- Dano: 35.

## Protagonista secundário

Especial: Proteção coletiva.

- Custo: 20.
- Alvo: todos os aliados vivos.
- Efeito: Guarda de 10 por golpe recebido.
- Duração: dois turnos.

## Protagonista feminina

Especial: Varredura tática.

- Custo: 25.
- Alvo: todos os inimigos vivos.
- Dano: 20 por inimigo.

AOE significa Area of Effect, uma habilidade que afeta múltiplos alvos.

---

# 13. Turno extra

O chefão do quarto combate possui uma habilidade especial de manipulação de turnos.

## Habilidade: Turno extra

- Custo: 50.
- Efeito: o próximo turno da partida pertence novamente à própria equipe.

Regras:

1. A fila de ações atual termina normalmente.
2. A equipe recebe imediatamente o próximo turno.
3. Esse novo turno concede +15 de energia.
4. As unidades vivas podem executar novamente uma habilidade cada.
5. O limite de energia permanece em 100.
6. Turnos extras podem ser acumulados: cada uso válido adiciona um turno adicional pendente para a equipe.
7. Não impor limite artificial ao número de turnos extras acumulados.

Não implementar restrição de cooldown sem aprovação. Com dois aliados usando Reter energia, um ciclo custa 50 e recupera 30 pelas habilidades e 15 no início do próximo turno, resultando em perda de 5 de energia por ciclo, antes de outros efeitos ou limites da reserva.

Cooldown significa intervalo obrigatório entre usos de uma habilidade.

---

# 14. Campanha

O planejamento narrativo prevê os caminhos abaixo. O cadastro inicial da seleção contém somente os dois primeiros; os demais serão adicionados futuramente, sem limite fixo de cards na interface.

1. Pondo o pé na estrada.
2. Nada era o que parecia.
3. Os problemas estavam apenas começando.
4. Vingança.
5. Conclusão.

Os nomes são provisórios.

Somente o primeiro caminho será jogável no MVP.

Os demais capítulos cadastrados devem aparecer bloqueados. Inicialmente, exibir apenas capítulo 1 e capítulo 2. O capítulo 2 permanece permanentemente bloqueado nesta revisão, mesmo após a conclusão da batalha 7 do capítulo 1; tentar acessar seus encontros ou iniciar batalhas neles deve retornar 403. As unidades e missões do capítulo 2 não aparecem na Lista de personagens nem na Tabela de missões.

## Página "Selecionar campanha" — apresentação aprovada

- Acessar pelo botão "Campanha" do menu autenticado; seta para a esquerda retorna ao menu principal.
- Cabeçalho e margens seguem o estilo da Lista de personagens. Referências: `TEMPLATE-LISTA-DE-PERSONAGENS.png` e o template específico `TEMPLATE-SELECIONAR-CAMPANHA.png` disponíveis em `assets/imgs/`.
- A página usa o mesmo céu compartilhado do menu principal e da Lista de personagens, sem alterar seu plano de fundo. Apenas os cards verticais possuem uma imagem de fundo independente por capítulo. Imagens temporárias são permitidas para os cards.
- Cadastrar apenas `path-1` / capítulo 1 / "Pondo o pé na estrada" e `path-2` / capítulo 2 / "Nada era o que parecia" no seed inicial.
- Capítulo 1 disponível: imagem colorida com opacidade reduzida em repouso. Ao passar o mouse ou focar pelo teclado, ampliar o card para **1,15×**, remover a opacidade da imagem e apresentar cores vivas.
- Capítulo bloqueado: imagem em preto e branco, escurecida sobre fundo preto; botão desabilitado. Não aplicar escala, highlight ou mudança de opacidade ao passar o mouse.
- Número do capítulo em laranja com contorno preto; título em branco com contorno preto. Textos devem ser HTML, não incorporados às imagens.
- Cards em uma única faixa de rolagem horizontal. Botões laterais avançam/voltam pela lista e ficam desabilitados nos limites. Permitir também teclado e gesto horizontal em telas de toque, sem overflow da página inteira.
- Novos capítulos são registros do banco, ordenados por `sort_order`; a página deve renderizar todos, sem exigir alteração de código ou contagem fixa de campanhas.
- Disponibilidade calculada no servidor a partir de `campaigns.released` e dos caminhos disponíveis no progresso da conta. Não confiar em userId arbitrário enviado pelo cliente.
- Clicar no capítulo disponível abre a página do mapa da campanha. O capítulo segue bloqueado até que esteja liberado para a conta.
- Respeitar redução de movimento desativando a escala animada e a rolagem suave quando solicitado pelo sistema.

## Página do mapa da campanha — apresentação aprovada

- Fundo com a arte `assets/imgs/mapa-campanha-01.png` como mapa do caminho, exibida em uma área própria de rolagem; a página inteira não gera overflow horizontal em nenhuma resolução.
- Os sete combates do caminho aparecem como pontos posicionados sobre o mapa por coordenadas percentuais (`mapX`/`mapY`) do registro do encontro; a quantidade de pontos segue os dados, sem contagem fixa no componente.
- Cada ponto mostra o número do combate. Estados: concluído com marca de verificação, o próximo disponível em destaque e os demais disponíveis ou bloqueados. Ponto bloqueado fica desabilitado e informa, em texto simples, qual batalha anterior precisa ser vencida.
- Somente o próximo combate não concluído é destacado como próximo; ao abrir a página, o mapa é rolado para centralizar esse ponto quando necessário.
- Cabeçalho fixo com botão de seta para a esquerda (volta para "Selecionar campanha"), título do capítulo e contador "n de 7 batalhas vencidas".
- Setas ←/→ movem o mapa horizontalmente.
- Ao clicar em um ponto, abrir um painel lateral em `dialog` alinhado à direita da tela, sem sobrepor o ponto selecionado em resoluções de desktop; em telas estreitas, o painel ocupa a largura disponível.
- Conteúdo do painel: número do combate ("Batalha n"), título, retratos e nomes dos adversários, texto de história, aviso de "Configuração provisória de encontro" quando o registro for provisório, botão "Iniciar batalha" e atalho "Montar equipe".
- Fechar pelo botão "×", pelo clique fora do conteúdo ou pela tecla Escape; durante o envio, impedir fechamento acidental.
- Iniciar batalha exige equipe com pelo menos uma unidade; sem equipe, exibir orientação e manter o botão desabilitado. Se já houver batalha em andamento para o encontro, oferecer "Retomar batalha".
- Erros da API aparecem no próprio painel, sem derrubar o mapa.

## Caminho 1 — Pondo o pé na estrada

Sete combates.

Cada combate deve possuir:

- ID.
- Título.
- Descrição.
- Diálogo narrativo introdutório.
- Equipe inimiga.
- Condições de vitória.
- Recompensas.
- Diálogo posterior.
- Estado de conclusão.

A progressão deve ser sequencial.

Não permitir iniciar um combate ainda bloqueado.

Após vencer um combate, desbloquear o próximo.

Permitir repetir encontros concluídos. Recompensas devem ser idempotentes: repetir a vitória ou reenviar a mesma confirmação não duplica desbloqueios. Derrota não avança a campanha. Progresso e recompensas são calculados e gravados pelo servidor; o cliente não pode declarar uma vitória para receber unidades.

---

# 15. Combate 1 — Saqueadores da estrada

Três inimigos comuns.

Todos possuem:

1. Golpe simples.
2. Guarda.
3. Reter energia.
4. Golpe forte.

Golpe forte:

- Custo: 25.
- Dano: 30 em um inimigo.

Objetivo narrativo:

Apresentar o primeiro confronto real dos protagonistas fora do vilarejo.

Esse combate também deve servir como introdução prática às mecânicas.

---

# 16. Combates 2 e 3 — A rota interrompida e os Grimorianos

## Combate 2 — A rota interrompida

Os protagonistas seguem uma estrada secundária para descobrir por que as caravanas deixaram de passar e encontram nova emboscada.

Composição atual provisória: os três saqueadores do combate 1, com as mesmas habilidades. O encontro está marcado como provisório na interface; a composição definitiva continua pendente.

Objetivo narrativo: mostrar que os ataques não são incidentes isolados e que existe organização por trás deles.

## Combate 3 — Os Grimorianos

Três mercenários jovens:

- Dois masculinos.
- Uma feminina.

Idade semelhante à dos protagonistas.

Eles retornarão em combates posteriores. Nomes aprovados: Jung de Grimória, Exal de Grimória e Monnica de Grimória.

### Rival masculino A

- Golpe simples.
- Guarda.
- Reter energia.
- Golpe forte.

### Rival masculino B

- Golpe simples.
- Guarda.
- Reter energia.
- Golpe forte.

### Rival feminina

- Golpe simples.
- Guarda.
- Reter energia.
- Recuperar vida.

A rival feminina recupera 20 HP de um aliado por 35 de energia.

Objetivo narrativo:

Introduzir antagonistas recorrentes e sugerir que existe uma organização por trás dos ataques.

---

# 17. Combate 4 — Guardião da passagem

Aberto somente após vencer o combate 3 (Os Grimorianos). Primeiro grande desafio.

Equipe inimiga:

- Chefão masculino.
- Aliado masculino curandeiro.
- Aliada feminina curandeira.

## Chefão

Possui:

1. Golpe forte.
2. Guarda.
3. Reter energia.
4. Turno extra.

O chefão não possui Golpe simples.

Seu ataque básico é Golpe forte.

## Aliados curandeiros

Cada um possui:

1. Golpe simples.
2. Guarda.
3. Reter energia.
4. Recuperar vida.

Objetivo narrativo:

Criar uma batalha mais complexa, com suporte e manipulação da ordem dos turnos.

## Recompensa

Ao vencer o combate 4, desbloquear a unidade jogável do chefão.

O desbloqueio deve persistir.

---

# 18. Combates 5 a 7

As habilidades e composições definitivas ainda não foram aprovadas.

Implementar a estrutura de campanha e deixar as definições desses encontros claramente configuráveis.

Não inventar silenciosamente habilidades permanentes ou novos poderes considerados oficiais.

## Inimigos posteriores a Drak — cadastro aprovado

Persistir no catálogo e no PostgreSQL:

- `guerreiros-habilidosos-a`: Trinity de Espinea.
- `guerreiros-habilidosos-b`: Vlade de Espinea.
- `guerreiros-habilidosos-c`: Passago de Espinea.
- `rival-b-final-mode`: Exal - Verdadeiro poder, vilão final da história, como nova unidade de Exal de Grimória (`rival-b`). Preservar `rival-b-base` e suas habilidades.

Cada unidade começa com 100 HP e quatro habilidades temporárias existentes: Golpe simples, Guarda, Reter energia e Golpe forte. Registrar `provisional=true` e a indisponibilidade para equipe. Gerar retrato e corpo inteiro mockados em PNG com alpha. A distribuição exata desses inimigos entre os encontros e seus poderes definitivos continuam configuráveis, sem alterar as recompensas aprovadas dos combates 4 e 6.

## Combate 5 — Os guerreiros de Espinea

Composição provisória atual: Trinity, Vlade e Passago de Espinea (`path-1-encounter-5`), reutilizando as habilidades existentes.

A narrativa definitiva deste encontro ainda não foi aprovada; a interface identifica o encontro como configuração provisória. Qualquer poder novo deve virar nova unidade jogável, sem alterar as existentes.

Os rivais do combate 3 podem retornar neste ou em encontros posteriores; se retornarem com novas habilidades, criar novas unidades jogáveis, preservando as anteriores.

## Combate 6 — O despertar de Ravi

Um dos rivais recorrentes retorna acompanhado de guerreiros poderosos.

A batalha provoca o despertar de uma transformação do protagonista principal. Composição provisória atual (`path-1-encounter-6`): Exal de Grimória e dois guerreiros de Espinea.

Ao vencer:

- Desbloquear a versão transformada do protagonista.
- Registrar a recompensa no progresso.

A transformação deve ser uma unidade independente, com aparência e habilidades próprias. As habilidades específicas dessa unidade ainda precisam ser definidas.

## Combate 7 — Exal, verdadeiro poder

Confronto final deste caminho. A identidade aprovada do vilão final da história é `rival-b-final-mode`; a participação específica nos encontros posteriores e as composições completas ainda precisam ser definidas. Composição provisória atual (`path-1-encounter-7`): `rival-b-final-mode` e dois guerreiros de Espinea. A referência anterior ao mentor como antagonista final não deve ser tratada como decisão definitiva.

Qualquer versão com habilidades diferentes deve ser representada por outra unidade jogável. Os poderes finais de `rival-b-final-mode` permanecem pendentes; o cadastro atual reutiliza habilidades existentes e é provisório.

### Estratégia de implementação

Implementar a infraestrutura funcional dos sete combates.

Para os encontros ainda não detalhados, usar configurações provisórias explicitamente marcadas como temporárias, reutilizando habilidades existentes quando necessário.

Não apresentar essas configurações como decisões narrativas definitivas.

---

# 19. Inteligência artificial

Implementar IA determinística e configurável.

No MVP, ela deve:

- Selecionar habilidades disponíveis.
- Respeitar energia compartilhada.
- Respeitar uma ação por personagem.
- Selecionar alvos válidos.
- Priorizar cura quando houver aliados feridos.
- Considerar proteção e ataques.
- Utilizar especiais quando estrategicamente viáveis.
- Encerrar turnos corretamente.

A IA não deve acessar informações ocultas do jogador.

Não utilizar modelos de linguagem ou serviços externos para controlar os inimigos.

A lógica deve ser executada no backend, sem serviços externos, e testável como funções puras. Utilizar as mesmas regras e validações disponíveis ao jogador. A previsão no navegador não altera o resultado oficial.

---

# 20. Interface de batalha

Referência estrutural: Naruto Arena clássico.

Não reproduzir seus assets originais.

## Composição

- Background de campo aberto entre florestas.
- Equipe do jogador à esquerda.
- Equipe inimiga à direita.
- Até três unidades por lado.
- Retratos ilustrados.
- Barras individuais de HP.
- Indicadores de efeitos ativos.
- Área de seleção de habilidades.
- Barra de energia da equipe.
- Fila de ações.
- Botão para confirmar turno.
- Informações da habilidade selecionada.

## Interação

O jogador deve conseguir:

1. Selecionar um personagem vivo.
2. Visualizar suas quatro habilidades.
3. Selecionar uma habilidade.
4. Escolher o alvo, quando necessário.
5. Adicionar a ação à fila com atualização imediata da barra de energia prevista.
6. Reordenar ou remover ações antes da confirmação, incluindo remoção por novo clique na habilidade enfileirada.
7. Visualizar a energia prevista após cada ação.
8. Confirmar a execução.
9. Acompanhar as ações com efeitos visuais.
10. Receber feedback de vitória ou derrota.

## Feedback visual

Exibir:

- Dano causado.
- Cura recebida.
- Energia recuperada.
- Energia consumida.
- Proteção aplicada.
- Proteção expirada.
- Personagem derrotado.
- Turno extra concedido.
- MISS contra alvo derrotado anteriormente no combo, sem devolução de energia.
- Envio do turno ao servidor, erro de validação, perda de conexão e recuperação do estado oficial.

Ações devem ser visualmente compreensíveis sem exigir animações complexas.

---

# 21. Efeitos visuais

Priorizar CSS.

## Golpe simples

- Movimento rápido do atacante.
- Flash de impacto.
- Número de dano.
- Pequena reação do alvo.

## Guarda

- Barreira azul translúcida.
- Ícone de proteção.
- Indicador da duração restante.

## Reter energia

- Partículas luminosas.
- Indicador +15 de energia.
- Atualização animada da barra.

## Golpe forte

- Impacto mais intenso.
- Pequeno deslocamento visual.
- Número de dano destacado.

## Cura

- Partículas verdes.
- Indicador +20 HP.
- Atualização da barra de vida.

## Turno extra

- Destaque visual da equipe.
- Mensagem de turno adicional.
- Transição para o novo turno.

Utilizar CSS animations e transitions sempre que possível.

Respeitar `prefers-reduced-motion`, configuração do sistema que solicita menos animações.

---

# 22. Seleção de personagens

Criar uma tela com:

- Grade de unidades.
- Retratos.
- Nome e versão.
- Estado bloqueado/desbloqueado.
- Descrição.
- Quatro habilidades.
- Condição de desbloqueio.
- Seleção de até três unidades para equipe.

Não permitir adicionar unidades bloqueadas à equipe. É permitido selecioná-las na lista para consultar seus detalhes, conforme a apresentação abaixo.

Permitir equipes com menos de três unidades.

Exigir ao menos uma unidade para iniciar uma batalha. Permitir versões diferentes do mesmo personagem narrativo na equipe, desde que sejam unidades distintas.

Não permitir duplicar a mesma unidade na mesma equipe.

O catálogo compartilhado de combate deve incluir também os inimigos. A lista visual apresenta todas as unidades cadastradas no banco, inclusive bloqueadas e Premium, sem filtrar uma seleção fixa de IDs. O campo `roster_order` controla somente a ordem; um registro sem ordem definida também deve aparecer. Somente unidades desbloqueadas na conta podem ser adicionadas à equipe.

## Lista de personagens — apresentação aprovada

Referência de layout: `assets/imgs/TEMPLATE-LISTA-DE-PERSONAGENS.png`.

- Utilizar o mesmo fundo de céu do menu principal e da seleção de campanha, sem background ou sobreposição próprios nessas páginas.
- Alinhar o container da lista ao canto superior esquerdo, com a mesma distância das bordas utilizada pelos itens do menu. Não centralizar horizontalmente o cabeçalho ou a grade em telas largas.

- Acessar pelo botão "Lista de personagens" do menu principal autenticado.
- Iniciar a página com um botão de seta para a esquerda, que volta ao menu principal, seguido do título "Lista de personagens".
- À esquerda, apresentar pequenos quadrados com os rostos dos personagens (face-thumbs).
- Ao clicar em qualquer miniatura, inclusive bloqueada, destacá-la visualmente e abrir os detalhes. Apenas uma miniatura fica selecionada de cada vez.
- Miniaturas bloqueadas ficam esmaecidas sobre uma div preta, mas são clicáveis para consulta. Nos detalhes, a imagem de corpo inteiro fica esmaecida com um cadeado à frente. O bloqueio impede a escalação, não a consulta.
- Os detalhes ocupam toda a altura disponível abaixo do cabeçalho. O bloco de imagem com o nome abaixo deve ficar centralizado horizontalmente em relação à tela, independente da largura dos painéis. Habilidades e descrição ficam ancoradas à direita, respeitando as margens e sem sobrepor o personagem. Na área do nome, não mostrar versão (como "Jovem da guarda") nem HP total; esses atributos continuam no banco e nas regras de combate.
- O corpo inteiro deve ser uma imagem PNG com alpha em uma div sem fundo, borda ou cartão atrás. Usar imagens mockadas por enquanto. Ícones de habilidades são JPEGs próprios, sempre na proporção 1:1 (quadrados), com defaults permitidos. A exibição também deve permanecer quadrada, sem distorcer ou recortar a arte.
- Colocar os golpes e suas descrições em um painel de fundo sólido e alto contraste. Os painéis de nome, atributos e descrição também devem ser opacos, sem transparência sobre o céu.
- Mostrar todas as unidades cadastradas em uma grade de cinco miniaturas por linha, com gap compacto de 6 px no desktop e 4 px em telas menores. Ajustar a largura das miniaturas para caber sem invadir a imagem central. Se a lista ultrapassar a altura disponível no desktop, rolar apenas a área das miniaturas.
- Enquanto não houver seleção, deixar a área de detalhes vazia, sem painel, mensagem ou elemento "Conheça seus personagens".
- Exibir a equipe atual no canto inferior esquerdo. Inicialmente, os três slots ficam vazios, como caixas de fundo cinza-escuro com um X ao centro. Fora de uma batalha, permitir uma equipe com zero a três unidades.
- Fixar o botão "Adicionar à equipe" na última linha do painel de descrição. Para unidade desbloqueada, abrir um modal de escolha entre os slots 1, 2 e 3; informar o ocupante atual e substituir ao escolher um slot ocupado. Ao mover uma unidade já escalada, liberar sua posição anterior, sem duplicá-la. Permitir remover uma unidade pelo X do slot ocupado.
- Para uma unidade bloqueada, manter o botão de adicionar desabilitado e mostrar a condição de desbloqueio nos detalhes. O backend deve rejeitar tentativas de escalar bloqueados, ainda que a requisição seja enviada manualmente.
- Persistir cada edição por conta no PostgreSQL e só atualizar a interface após confirmação da API. Falha de rede mantém a equipe anterior e permite tentar novamente.
- A edição de equipe não exibe avisos ou mensagens de sucesso após a gravação: a própria lista já reflete o novo estado.
- As miniaturas da lista não exibem tooltip ao passar o mouse; o nome permanece sempre visível ao lado da imagem no painel de detalhes. O único título nativo permitido é o da condição no botão desabilitado de adicionar de uma unidade bloqueada.
- Remover os textos auxiliares "Seus companheiros de jornada", "n/n unidades desbloqueadas", "Retratos e ilustrações provisórios.", "Equipe atual da sua conta.", "ARTE PROVISÓRIA" e "Nomes e artes provisórios".
- Ler desbloqueios e equipe do progresso autenticado no servidor. Falha de carregamento não concede personagens; permitir nova tentativa e tratar sessão expirada.
- Registrar o caráter mockado das imagens e os poderes ainda pendentes nos metadados/documentação, sem os avisos removidos da interface. Os seis nomes aprovados substituem os nomes provisórios sem alterar IDs.
- Em telas menores, reorganizar as colunas sem perder acesso às miniaturas, detalhes ou botão de retorno e sem rolagem horizontal. Em desktop com pouca altura, permitir rolagem interna nas habilidades e no texto da descrição, mantendo nome e botão de adicionar visíveis. Permitir selecionar miniaturas por teclado.

---

# 23. Persistência no servidor — PostgreSQL

Salvar por conta autenticada:

- Configuração de áudio.
- Progresso da campanha.
- Combates concluídos.
- Unidades desbloqueadas.
- Equipe selecionada.
- Estado de disponibilidade dos caminhos.

Utilizar PostgreSQL, acessado exclusivamente pelo backend através de repositórios encapsulados. Não utilizar IndexedDB, localStorage ou sessionStorage como banco de dados do jogo ou armazenamento de credenciais.

Esquema inicial:

- `users`: ID estável, e-mail único normalizado, hash de senha e data de criação.
- `sessions`: hash do token, usuário, expiração e data de criação.
- `player_progress`: usuário, dados JSONB versionados, revisão e data de atualização.
- `schema_migrations`: histórico das migrações SQL aplicadas.
- `narrative_characters`: identidades narrativas.
- `abilities`: habilidades, custos, alvos, efeitos e caminhos dos ícones JPEG.
- `units`: versões jogáveis, atributos, desbloqueios, ordem na lista e caminhos dos PNGs.
- `unit_abilities`: quatro habilidades ordenadas por unidade.
- `player_team_slots`: slots 0, 1 e 2 por usuário, com unidade opcional, sem duplicar a mesma unidade na equipe.
- `campaigns`: ID estável, número, título, descrição, caminho da imagem, ordenação e estado de lançamento do capítulo. Apenas dois registros iniciais.

Disponibilizar catálogo autenticado por `GET /api/catalog` e edição de slot por `PUT /api/team/slots/:slot`, recebendo `{ unitId }` ou `{ unitId: null }`. A interface lê o catálogo do banco; `shared/content` fornece apenas as definições para o seed e contratos compartilhados.

Disponibilizar `GET /api/campaigns` autenticado, retornando os capítulos do banco e sua disponibilidade para a conta da sessão. O seed não deve sobrescrever progresso do usuário ou o estado de lançamento de capítulos já cadastrados ao ser reaplicado.

O comando de migração inicializa o catálogo com seed idempotente. Atualizar nomes, textos e caminhos não deve sobrescrever silenciosamente custos/efeitos ou loadouts existentes. Na transição, converter somente a antiga equipe automática inicial para vazia e preservar configurações personalizadas; retirar a cópia de equipe do JSONB para manter `player_team_slots` como fonte única.

Adicionar persistência do estado oficial de batalhas e dos comandos processados durante a implementação do combate. O backend será responsável por validar comandos e impedir confirmação duplicada de turnos, acesso a batalhas alheias e concessão arbitrária de recompensas.

Implementar versionamento do esquema SQL e dos dados de progresso. Executar migrações de forma transacional. Cadastro deve criar usuário, progresso e sessão atomicamente.

Garantir que atualizações futuras não apaguem desnecessariamente o progresso.

O estado oficial do combate pertence ao servidor e deve poder ser consultado para sincronizar o cliente. Persistir esse estado no PostgreSQL é a estratégia definida para a implementação full-stack. Não exigir retomada de animações interrompidas: a interface pode reconstruir a apresentação a partir do estado oficial.

O MVP requer conexão com a API; não inclui modo de jogo offline ou sincronização de saves locais. Falhas de rede devem produzir feedback e permitir nova tentativa sem duplicar comandos ou recompensas.

---

# 24. Preparação para multiplayer

Não implementar multiplayer nesta versão.

O Game Core já será utilizado pelo servidor para resolver partidas de campanha contra a IA e pelo cliente para previsão. Essa separação prepara o jogo para multiplayer futuro.

Requisitos:

- Regras determinísticas.
- Estado serializável.
- Ações representadas por comandos.
- Validação independente da interface.
- Nenhuma regra crítica dependente do DOM.
- Separação entre ações solicitadas e ações executadas.

O servidor será autoritativo desde o MVP: responsável por validar e manter o estado oficial da partida e suas recompensas. O cliente envia comandos, não resultados confiáveis.

Utilizar HTTP autenticado para a campanha. Não introduzir matchmaking, salas PvP, WebSockets ou infraestrutura de multiplayer nesta versão.

---

# 25. Testes obrigatórios

Criar testes automatizados para:

1. Dano simples.
2. Dano forte.
3. Cura com limite de HP.
4. Energia máxima de 100.
5. Regeneração de 15 por turno.
6. Reter energia.
7. Guarda reduzindo cada golpe recebido.
8. Expiração da Guarda.
9. Guarda AOE.
10. Ataque AOE.
11. Fila com recuperação intermediária de energia.
12. Uma habilidade por personagem por turno.
13. Personagens derrotados não executando ações.
14. Vitória.
15. Derrota.
16. Turno extra.
17. Regeneração no turno extra.
18. Desbloqueio do chefão.
19. Persistência de progresso.
20. Imutabilidade das definições das unidades.
21. MISS contra alvo derrotado no combo, mantendo custo e ação consumida.
22. Acúmulo de turnos extras e perda de 5 de energia no ciclo com duas recuperações de 15.
23. Remoção e reordenação da fila recalculando energia sem cobrança duplicada.
24. Reaplicação de Guarda sem acumular redução e duração considerando turnos extras.
25. Cadastro, normalização de e-mail, duplicidade e validação de senha.
26. Login válido e inválido, rotação de sessão, expiração e logout.
27. Cookies de sessão, verificação de origem e limitação de tentativas.
28. Isolamento de progresso, equipe e batalhas entre contas autenticadas.
29. Transação de cadastro e rollback sem conta, progresso ou sessão parcialmente criados.
30. Migrações SQL reaplicáveis sem perda dos dados e persistência após recriação do serviço.
31. Reenvio de comandos e recompensas sem processamento duplicado.
32. Catálogo persistido com os seis nomes aprovados, quatro habilidades e caminhos PNG/JPEG.
33. Slots vazios, escolha de posição, substituição, movimentação sem duplicação e remoção persistentes por conta.
34. Consulta de unidade bloqueada sem permitir sua escalação, inclusive por requisição manual.
35. Concorrência nas alterações de equipe e migração da equipe automática sem apagar configurações personalizadas.
36. Seleção de campanha com dois capítulos iniciais, primeiro disponível e segundo bloqueado.
37. Isolamento da disponibilidade por conta e bloqueio de capítulos não lançados.
38. Expansão da lista por novos registros do banco, rolagem horizontal e retorno ao menu.
39. Catálogo completo na lista, incluindo registros sem `roster_order`, sem conceder desbloqueios.
40. `rival-b-final-mode` e Besta Lendária com condição Premium persistida, impedindo escalação enquanto bloqueados.
41. Nomes e ordem aprovados no catálogo/SQL/API, com reordenação idempotente sem conflitos de posição e sem alterar equipe, desbloqueios ou habilidades.
42. Mapa da campanha com sete pontos, progressão sequencial que impede pular encontros e desbloqueio do chefão somente após os três primeiros combates.
43. Abertura, retomada e fechamento do painel de detalhes do encontro, exigência de equipe para iniciar e sessão expirada tratada sem inventar progresso.

Testar também sequências de ações inválidas e limites de recursos. Testes HTTP podem usar repositório em memória somente como dublê; testes de integração devem executar contra PostgreSQL real em banco exclusivo de testes. Não usar o banco de desenvolvimento para testes destrutivos.

---

# 26. Critérios de aceite

O MVP será considerado funcional quando:

- A aplicação iniciar sem erros.
- A tela inicial apresentar os assets existentes.
- O botão "Começar jogo" solicitar autenticação quando necessário e permitir acesso ao menu principal com sessão válida.
- Cadastro, login, restauração de sessão e logout funcionarem por e-mail e senha.
- Contas e sessões persistirem no PostgreSQL, sem confirmação de e-mail ou login social.
- Todos os menus previstos estiverem navegáveis.
- Multiplayer aparecer desabilitado, sem texto auxiliar à direita do nome.
- A seleção de campanha apresentar os dois capítulos iniciais, somente o primeiro disponível, e permitir novos capítulos por dados do banco com rolagem horizontal.
- O primeiro caminho apresentar sete combates.
- O jogador conseguir iniciar uma batalha.
- O combate 3v3 funcionar integralmente.
- A IA conseguir jogar turnos válidos.
- As habilidades produzirem os efeitos corretos.
- A fila respeitar a ordem das ações e a energia.
- O jogador conseguir vencer ou perder.
- O progresso for salvo no PostgreSQL e isolado por conta autenticada.
- O backend validar batalhas, comandos, progressão e recompensas sem confiar em resultados enviados pelo cliente.
- O chefão do combate 4 for desbloqueado após a vitória, somente após vencer o combate 3.
- A transformação do protagonista for desbloqueada após o combate 6, mesmo que seus poderes definitivos ainda estejam pendentes de aprovação.
- A loja apresentar a unidade premium sem processar pagamentos reais.
- A configuração de áudio persistir.
- Os testes automatizados passarem.

---

# 27. Estratégia de execução do agente

Implemente em etapas:

## Fase 1 — Fundação

- Inspecionar o projeto.
- Organizar a arquitetura.
- Configurar frontend, API e PostgreSQL.
- Criar migrações para usuários, sessões e progresso.
- Implementar e testar cadastro, login, sessão e logout.
- Integrar os assets.
- Implementar navegação.
- Criar o catálogo de personagens e habilidades.

## Fase 2 — Motor de combate

- Estado da batalha.
- Persistência do estado oficial e resolução autenticada no servidor.
- Turnos.
- Energia.
- Fila.
- Habilidades.
- Efeitos de status.
- Vitória e derrota.
- Testes unitários.

## Fase 3 — Interface de combate

- Background.
- Equipes.
- HP.
- Energia.
- Seleção de habilidades.
- Fila.
- Animações CSS.
- Feedback de ações.

## Fase 4 — Campanha

- Seleção extensível de capítulos, com dois registros iniciais.
- Sete encontros.
- Narrativa.
- IA.
- Progressão.
- Desbloqueios.

## Fase 5 — Sistemas complementares

- Lista de personagens.
- Seleção de equipe.
- Loja.
- Configurações.
- Persistência.
- Endpoints autenticados para equipe e áudio, com autorização e validação.

## Fase 6 — Validação

- Executar testes.
- Corrigir erros.
- Verificar navegação.
- Validar combates completos.
- Verificar persistência.
- Validar isolamento entre contas, sessões, transações e reenvio de comandos.
- Documentar limitações.

---

# 28. Regras de trabalho

1. Não reescrever desnecessariamente funcionalidades existentes.
2. Não modificar regras de combate aprovadas.
3. Não misturar regras de negócio com componentes React.
4. Não duplicar personagens entre jogador e IA.
5. Não implementar pagamentos reais no MVP.
6. Não implementar multiplayer agora.
7. Não utilizar assets protegidos de outras franquias.
8. Não introduzir dependências sem justificativa.
9. Não considerar uma tela estática como funcionalidade concluída.
10. Não inventar decisões definitivas onde a especificação indicar conteúdo pendente.
11. Manter o projeto executável ao final de cada fase.
12. Documentar decisões técnicas relevantes.
13. Priorizar funcionamento real sobre abstrações excessivas.

## Entregáveis

Ao finalizar, fornecer:

- Código-fonte completo.
- README com instruções de instalação e execução.
- Estrutura de diretórios documentada.
- Lista de funcionalidades implementadas.
- Lista de funcionalidades pendentes.
- Testes automatizados.
- Registro de decisões técnicas.
- Comandos necessários para executar o projeto localmente.
- Configuração de ambiente, Docker Compose, migrações e instruções para executar os testes com PostgreSQL.

**Comece inspecionando os arquivos disponíveis e propondo uma estrutura técnica enxuta. Em seguida, implemente o MVP de forma incremental, validando cada etapa.**

Antes de implementar, analise integralmente a especificação e apresente a arquitetura proposta, as decisões técnicas e as ambiguidades identificadas. Não altere regras de negócio para simplificar a implementação. Após essa análise, implemente incrementalmente, mantendo testes automatizados para o motor de combate.

Durante uma fase explicitamente limitada a planejamento, não implemente código ou instale dependências. Atualizações de documentação e implementação são permitidas após autorização do usuário e habilitação do modo de edição. Analise a especificação, identifique ambiguidades, proponha a arquitetura e decomponha a implementação em tarefas pequenas, com dependências, critérios de aceite e testes associados. Diferencie decisões técnicas de regras de negócio que exigem aprovação. Não execute operações Git - porém o projeto será versionado no Git.

## Estado da implementação nesta revisão

A fundação React/Vite, API Fastify, migrações PostgreSQL, autenticação e progresso estão implementados. A lista mostra todo o catálogo persistido em cinco colunas, com imagem/nome centralizados e dados à direita. Unidades bloqueadas abrem detalhes com cadeado, sem permitir escalação; a forma final do rival B e a Besta Lendária são Premium. A equipe começa vazia e pode ser editada em três slots persistentes por conta, sem avisos de sucesso e sem tooltip nas miniaturas.

A página "Selecionar campanha" está implementada com dois capítulos persistidos, estados visuais de disponibilidade, seleção e carrossel extensível. O capítulo disponível abre a página do mapa da campanha, com os sete pontos de batalha posicionados sobre a arte do mapa, painel lateral de detalhes e progressão sequencial validada pelo servidor.

O motor de combate determinístico (`shared/core/battle.ts`) e a resolução autoritativa no backend estão implementados: criação de batalha por encontro disponível, validação de equipe, fila com prévia de energia, MISS, turnos extras acumuláveis, IA determinística e recompensas idempotentes. A interface de batalha é montada sob demanda (chunk separado). O balanceamento de habilidades foi atualizado por migrations idempotentes, incluindo Força interna, Investida, Varredura tática, Fúria devastadora, Drenar existência, Recuperar vida, Guarda e a troca de habilidade do Saqueador da estrada I.

O catálogo atual possui 38 unidades persistidas, incluindo Capitão da guarda Kalis e Capitão da guarda Ridan, que só entram no sorteio de Batalha rápida após serem desbloqueados com três vitórias rápidas. A Lista de personagens, a Batalha rápida e a Tabela de missões exibem apenas o conteúdo do capítulo 1; as unidades e missões do capítulo 2 ficam ocultas, e o capítulo 2 permanece bloqueado mesmo após a batalha 7. A loja exibe as duas unidades premium com arte original, sem cadeado, botão de aquisição desabilitado e estado "Personagem adquirido" quando já desbloqueadas na conta, sem checkout ou cobrança real.

Verificações desta revisão: `npm run typecheck`, `npm test` (275 testes), `npm run test:db` (74 testes) e `npm run build` passaram. Restam no backlog: áudio, diálogos completos dos sete encontros, transformação com poderes próprios, integração real de pagamentos e validação manual final da jornada no navegador.
