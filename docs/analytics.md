# Analytics: proposta mínima de implantação

**Status:** configuração, consentimento, carregamento condicionado do GA4 e visualizações manuais de tela implementados. Coleta desabilitada por padrão no build; eventos de ações, relatórios e validação na propriedade GA4 ainda pendentes.

**Escopo escolhido:** audiência e funil agregados, sem acompanhamento por conta.

## 1. Objetivo

Entender quem chega ao Rave Trail, como descobre o jogo e até onde avança na experiência.

| Pergunta | Informação esperada |
|---|---|
| Quantas pessoas chegam? | Usuários, sessões e evolução diária/semanal |
| De onde vêm? | Busca, redes sociais, links de divulgação e acesso direto |
| Qual é o perfil técnico? | Dispositivo, navegador, sistema operacional e idioma |
| De quais regiões vêm? | País e região aproximados; cidade quando houver dados suficientes |
| Quantas conseguem jogar? | Visitantes em telas compatíveis e visitantes que recebem o aviso de acesso pelo computador |
| Onde desistem? | Caminho entre entrada, autenticação, menu e início da batalha |
| Elas voltam? | Usuários recorrentes e retenção observada no mesmo navegador/dispositivo |

Essas métricas descrevem a parcela observável dos acessos. Consentimento, bloqueadores, limpeza de cookies e troca de dispositivo afetam as contagens. Um usuário no analytics não equivale necessariamente a uma pessoa ou a uma conta cadastrada. Não se pretende identificar nominalmente os visitantes, nem coletar idade, gênero ou interesses nesta fase.

## 2. Contexto do projeto

- Frontend React/TypeScript/Vite e backend Fastify/PostgreSQL.
- Publicação prevista na infraestrutura documentada de Lightsail, Caddy, ECR e GitHub Actions; ver [deploy](deploy/README.md).
- As telas internas são controladas por estado em `frontend/src/App.tsx`, sem alteração de URL na maior parte da navegação.
- `frontend/src/components/DesktopAccess.tsx` impede acesso ao jogo em larguras inferiores a 720 px e altera a URL para `/acesse-pelo-computador`.
- `/sobre/` possui uma entrada HTML própria e funciona sem carregar a SPA; ver [SEO](seo.md).
- O resultado oficial das batalhas é mantido pelo servidor. A tela consulta atualizações da batalha por polling, aproximadamente a cada segundo enquanto ativa.
- A integração GA4 está em `frontend/src/analytics/`, condicionada ao build e à aprovação do visitante. CloudWatch RUM não está integrado.

Instalar apenas uma tag de analytics não basta para acompanhar a jornada entre as telas internas.

## 3. Soluções consideradas e recomendação

| Solução | Adequação | Custo e operação |
|---|---|---|
| **Google Analytics 4 (GA4)** | Aquisição, audiência, campanhas, funil e retorno | Plano padrão sem cobrança de licença; exige instrumentação e configuração dos relatórios |
| **Amazon CloudWatch RUM** | Desempenho e erros do navegador, com recortes por dispositivo e sessão | Cobrança por uso; exige app monitor, autorização de envio, amostragem e acompanhamento de custo |
| **Pipeline próprio na AWS** | Coleta e análises totalmente personalizadas | Exige ingestão, armazenamento, consultas e dashboards; esforço desproporcional ao escopo inicial |

**Recomendação:** começar com GA4 integrado diretamente por uma camada pequena de analytics no frontend, sem necessidade inicial de Google Tag Manager.

A hospedagem na AWS não exige usar uma ferramenta AWS para analytics. O CloudWatch RUM pode complementar o GA4 quando houver demanda concreta de diagnóstico técnico; ver também a [proposta de qualidade do frontend](frontend-quality.md).

## 4. Instrumentação mínima

| Evento | Momento de registro | Parâmetros principais |
|---|---|---|
| `page_view` | Entrada e mudança efetiva de tela | `screen_name`, `page_title`, `page_location` e `page_referrer` |
| `play_click` | Clique em começar na tela inicial | `screen_name` de origem |
| `sign_up` | Cadastro confirmado pela API | `method: email` |
| `login` | Login confirmado pela API | `method: email` |
| `battle_start` | Criação da batalha confirmada pela API | `game_mode` e `encounter_id`, quando aplicável |
| `battle_end` | Resultado oficial apresentado ao jogador | `game_mode`, `encounter_id`, quando aplicável, e `result` |
| `unsupported_viewport` | Exibição do bloqueio para largura inferior a 720 px | `viewport_bucket`, uma faixa de largura predefinida |

### Navegação e atribuição

- Definir uma lista estável de telas: `title`, `auth`, `menu`, `characters`, `store`, `campaigns`, `map`, `quick-battle`, `unlocks`, `battle`, `unsupported-viewport` e `about`.
- Controlar os `page_view` manualmente e desativar o envio automático de visualização inicial e por histórico que possa duplicá-los.
- Usar localizações virtuais estáveis para as telas internas, sem precisar criar rotas HTTP. Elas são identificadores analíticos, não páginas indexáveis.
- Informar a tela anterior nas transições; na entrada, preservar a origem externa da visita.
- Preservar origem, caminho de entrada e parâmetros de campanha antes da alteração de URL feita por `DesktopAccess.tsx`.
- Tratar URLs e parâmetros por lista de campos permitidos, evitando enviar dados pessoais ou parâmetros arbitrários. UTMs de divulgação também não devem conter dados pessoais.
- Registrar o bloqueio por largura uma vez por exposição efetiva, sem novo evento a cada renderização ou resize que mantenha o mesmo estado.
- Ao aceitar a coleta depois da navegação inicial, registrar a tela atual; não reconstruir retroativamente toda a atividade anterior ao aceite.

### Ações e deduplicação

- Registrar cadastro, login e início da batalha após confirmação da API, sem contar cliques malsucedidos como sucesso.
- Deduplicar encerramentos diante de polling, remontagens e atualizações React. O identificador interno da batalha pode apoiar a deduplicação local, sem ser enviado como dimensão ao GA4.
- Definir resultados analíticos estáveis, como `victory`, `defeat` e `abandoned`, conforme os estados oficiais retornados pela API.
- Não enviar eventos por turno, por polling ou por reprodução dos vídeos de fundo no escopo mínimo. Revisar as opções de medição otimizada para evitar coleta irrelevante.
- Manter analytics fora de `shared/src/core/`; o motor de combate continua independente de navegador e fornecedor de telemetria.
- Tratar falha, lentidão ou bloqueio da ferramenta sem afetar o jogo. A coleta não deve bloquear a interface nem comandos para a API.

`battle_end` representa um resultado observado no navegador. Se o jogador fechar a aba antes de recebê-lo, esse evento pode não existir. Os registros do servidor continuam sendo a fonte dos totais oficiais de partidas.

## 5. Relatórios e indicadores iniciais

Configurar quatro visões no GA4:

1. **Aquisição:** origem, mídia e campanha, acompanhadas de usuários e cadastros observados.
2. **Audiência técnica:** dispositivo, navegador, idioma, região e ocorrência do bloqueio por largura.
3. **Funil:** entrada → começar → cadastro/login → menu → batalha.
4. **Retorno:** usuários novos/recorrentes e retenção por coorte, conforme volume disponível.

O funil deve separar visitantes que criam conta de jogadores que entram em uma conta existente. Sessões já autenticadas podem ir diretamente ao menu e precisam ser consideradas na análise, sem serem tratadas como falha de autenticação.

### Definições iniciais

- **Ativação observada na sessão:** proporção dos usuários observados que iniciam pelo menos uma batalha na sessão analisada. Não representa necessariamente a primeira batalha da vida da conta.
- **Conversão de cadastro na sessão:** usuários observados com `sign_up` divididos pelos usuários observados que entram no funil de novos visitantes, no mesmo recorte.
- **Barreira de largura:** proporção de usuários observados com `unsupported_viewport`; um usuário pode receber o aviso e depois redimensionar a janela para jogar.
- **Retenção:** retorno do identificador do navegador/dispositivo, sem união da jornada entre dispositivos por conta.

Registrar como dimensões personalizadas os parâmetros necessários aos relatórios, especialmente `screen_name`, `game_mode`, `encounter_id`, `result` e `viewport_bucket`. Usar valores de baixa cardinalidade e marcar `sign_up` como evento principal. A ativação deve ser analisada por usuário/sessão, sem tratar cada batalha como uma nova primeira ativação.

Padronizar UTMs em todas as divulgações. Exemplo ilustrativo: `?utm_source=instagram&utm_medium=social&utm_campaign=lancamento`.

## 6. Requisitos de implantação

### Primeiro passo realizado: configuração do frontend

- ID de medição informado para o projeto: `G-B68K6N7WP1`.
- Variáveis públicas documentadas em `frontend/.env.example`, lidas por `frontend/src/analytics/config.ts`.
- `VITE_ANALYTICS_ENABLED=false` mantém a configuração desabilitada. O módulo também desabilita analytics no servidor de desenvolvimento do Vite e exige um ID válido.
- O Vite usa `frontend/` como raiz: para configuração local, copiar `frontend/.env.example` para `frontend/.env.local`. As variáveis são incorporadas durante o build; o `.env` da raiz não é carregado automaticamente pelo frontend.
- A interface de consentimento está disponível no jogo (inclusive na tela de largura incompatível) e em `/sobre/`, em português e inglês. Permite clicar em “Aprovar” ou recusar. O botão “Preferências” para rever a escolha aparece exclusivamente no menu principal.
- A preferência é salva no `localStorage` com a chave versionada `rave-trail-analytics-consent-v1`, compartilhada pelas páginas na mesma origem e sincronizada entre abas. Sem acesso ao armazenamento, a escolha vale apenas na página atual, com aviso ao visitante. Valores ausentes ou inválidos exigem nova escolha.
- O script Google só é solicitado com configuração habilitada e preferência `accepted`. Uma aprovação salva permite retomar a coleta nas próximas visitas, sem novo clique. Antes da aprovação, as mudanças de tela apenas atualizam a referência local da tela atual: não são enviadas ou reconstruídas depois.
- Após carregar o script, o cliente configura o GA4 sem visualização automática e envia um `page_view` da tela atual. As mudanças seguintes geram visualizações manuais deduplicadas; o jogo, `/sobre/` e o bloqueio por largura usam esse mesmo cliente. Não há instrumentação de cadastro, login ou ações de batalha nesta etapa.
- Ao recusar ou remover a aprovação, o cliente ativa `ga-disable`, descarta comandos pendentes e remove cookies `_ga`/`_ga_*` acessíveis à aplicação no caminho raiz e domínios compatíveis. Um download já iniciado pode terminar, mas sua conclusão não configura nem envia eventos se a aprovação tiver sido retirada. Dados já enviados não são apagados por esse controle.
- A configuração desabilita Google Signals e personalização de anúncios, com consentimentos publicitários negados. Manter a medição otimizada desativada no fluxo web para evitar eventos automáticos fora deste escopo.
- URLs analíticas são estáveis, sem query strings ou fragmentos; a origem externa é reduzida ao domínio de origem. A preservação de UTMs de campanha ainda está pendente, portanto os relatórios atuais não cobrem a atribuição completa prevista nesta proposta.

### Habilitação e publicação

1. Manter a coleta desabilitada até concluir o aviso de privacidade e as definições aplicáveis ao público do jogo, configurar retenção e revisar o fluxo web GA4.
2. Em **Settings → Secrets and variables → Actions → Variables**, definir `VITE_ANALYTICS_ENABLED=true`. O workflow usa `VITE_GA_MEASUREMENT_ID` quando fornecido, com padrão `G-B68K6N7WP1`. São configurações públicas; o workflow também aceita os mesmos nomes em **Secrets**, como alternativa de cadastro, dando prioridade a **Variables**. Mesmo cadastradas como secrets, essas configurações são incorporadas ao bundle público.
3. O workflow passa as variáveis como argumentos do build Docker; a coleta ainda depende da aprovação no navegador. Publicar uma nova imagem para aplicar alterações.
4. Para build direto, fornecer as variáveis de ambiente ao comando `npm run build:web`, ou usar `frontend/.env.local`. Para Docker manual, fornecer `--build-arg VITE_ANALYTICS_ENABLED=true` e, se necessário, `--build-arg VITE_GA_MEASUREMENT_ID=G-B68K6N7WP1`.
5. Para desabilitar globalmente, definir `VITE_ANALYTICS_ENABLED=false` e publicar novamente. Alterar apenas o ambiente do container em execução não atualiza o bundle.
6. Validar na propriedade de teste e no navegador: nenhuma requisição ao Google antes da aprovação; uma visualização por transição após aprovação; interrupção após recusa; preferência compartilhada com `/sobre/`. Typecheck, build e testes locais não substituem essa conferência de rede e recebimento no GA4.

### Conta e configuração externa

- Conta Google sob controle do projeto.
- Propriedade GA4 e fluxo web para `rave-trail.com.br`.
- Responsável pela administração e acesso de leitura para quem acompanhará os resultados.
- Fuso horário definido para os relatórios.
- Propriedade separada para validação, ou coleta desativada nos ambientes locais e no CI.
- Exclusão ou identificação do tráfego de desenvolvimento e testes, validada antes de ativar filtros definitivos.

### Aplicação e publicação

- Criar um módulo centralizado, por exemplo em `frontend/src/analytics/`, com inicialização, eventos tipados, navegação e controle de consentimento.
- Compartilhar a inicialização e a preferência de coleta entre o jogo e `/sobre/`, preservando o funcionamento da apresentação sem JavaScript.
- Configurar identificador público de medição e controle de habilitação durante o build. Não são credenciais secretas.
- Ajustar Dockerfile e GitHub Actions para fornecer a configuração durante a compilação do frontend. Variáveis adicionadas apenas ao container em execução não alteram o bundle já gerado pelo Vite.
- Documentar como desativar a coleta e publicar novamente, caso seja necessário.
- Revisar eventuais políticas de conteúdo e de conexão caso sejam introduzidas ou alteradas na implementação.

### Privacidade e minimização

- Publicar aviso de privacidade com finalidade, fornecedor, dados tratados, retenção e forma de rever a escolha de coleta.
- Adotar inicialmente coleta opcional: aceitar, recusar e rever a escolha, carregando analytics após o aceite.
- Persistir a preferência necessária para respeitar a escolha nas páginas do site. Ao revogar, interromper novos envios e remover os identificadores locais de analytics sob controle da aplicação; isso não apaga automaticamente dados já enviados.
- Não enviar e-mail, nome, senha, cookie de sessão, conteúdo dos formulários ou identificador de conta. Não usar hash de e-mail como substituto.
- Manter Google Signals, personalização publicitária e integrações de remarketing desativados nesta fase.
- Definir retenção. Sugestão inicial: dois meses para dados de eventos/usuários usados nas explorações do GA4; essa configuração não implica apagar todos os relatórios agregados no mesmo prazo.

## 7. Validação e critérios de aceite

- [ ] Navegação gera os eventos esperados no DebugView, sem duplicação de `page_view`.
- [ ] Cadastro e login malsucedidos não geram eventos de sucesso.
- [ ] Uma batalha gera um início e, quando observado, um único encerramento, inclusive diante de polling e remontagem.
- [ ] Visitas em largura incompatível aparecem separadamente.
- [ ] UTMs e origem permanecem corretas no fluxo do aviso de acesso.
- [ ] Aceite, recusa e revogação são respeitados no jogo e em `/sobre/`.
- [ ] Inspeção das requisições confirma a ausência de campos pessoais e credenciais.
- [ ] O jogo funciona normalmente com analytics bloqueado ou indisponível.
- [ ] Desenvolvimento e CI não poluem a propriedade de produção.
- [ ] Os quatro relatórios estão configurados; eventos são conferidos em tempo real e, após processamento, nos relatórios.

## 8. Custo, esforço e implantação por etapas

**Custo incremental:** GA4 padrão sem licença. Desenvolvimento, validação e manutenção da instrumentação são o principal investimento. Exportações para outros serviços e ferramentas adicionais não estão incluídas.

**Esforço estimado:** 1–2 dias de desenvolvimento e configuração, com acessos e textos disponíveis, mais validação após publicação. É uma estimativa inicial, não um prazo já comprometido.

### Sequência sugerida

1. Criar propriedade, fluxo web e ambiente de validação; definir UTMs, retenção e texto de privacidade.
2. Implementar camada centralizada, consentimento, navegação e eventos mínimos.
3. Validar eventos, deduplicação, atribuição e payloads em ambiente de teste.
4. Configurar os relatórios e publicar a coleta de produção.
5. Acompanhar semanalmente aquisição, bloqueio por largura, ativação e retorno, anotando datas de releases e campanhas.

## 9. Evolução com CloudWatch RUM

Reavaliar quando surgir necessidade de responder a perguntas como “qual navegador está falhando?” ou “quais jogadores enfrentam lentidão?”.

Requisitos dessa evolução:

- App monitor em região AWS suportada e cliente web configurado para o domínio.
- Autorização de envio restrita ao monitor, por política de recurso ou mecanismo suportado de credenciais temporárias; nunca chaves AWS permanentes no frontend.
- Amostragem explícita, controle de consentimento e filtros para URLs, erros e dados sensíveis.
- Orçamento de ingestão, acompanhamento de uso e alertas de custo.
- Estimativa que considere o polling da batalha a cada segundo: coleta de rede indiscriminada pode gerar muito mais eventos do que a navegação sugere.
- Retenção definida. O RUM mantém telemetria por 30 dias; cópias em CloudWatch Logs permitem outra retenção e acrescentam custos de logs.

O custo deve ser estimado pelo volume de sessões coletadas, eventos por sessão e preço regional, somado a logs e outros recursos habilitados. Não considerar o período de avaliação gratuita como franquia permanente.

O RUM complementa o analytics de produto e o [monitoramento de infraestrutura](deploy/monitoring.md), com foco na experiência real do navegador.

## 10. Referências

- [GA4: eventos](https://support.google.com/analytics/answer/9322688?hl=pt-BR).
- [GA4: medição de aplicações de página única](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications).
- [Amazon CloudWatch RUM](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-RUM.html).
- [Autorização para envio ao CloudWatch RUM](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-RUM-get-started-authorization.html).
- [Preços do Amazon CloudWatch](https://aws.amazon.com/cloudwatch/pricing/).
