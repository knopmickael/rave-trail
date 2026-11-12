# Qualidade do frontend: proposta mínima de validação

**Status:** proposta; as ferramentas e verificações adicionais descritas ainda precisam ser implantadas. Não foi executada uma auditoria Lighthouse para definir as metas abaixo.

## 1. Objetivo

Detectar regressões de carregamento, acessibilidade e navegação antes da publicação do Rave Trail, com uma rotina pequena e reproduzível.

Esta proposta trata da qualidade da interface. Aquisição, audiência e comportamento agregado estão na [proposta de analytics](analytics.md). As duas frentes se complementam: uma mede a jornada dos visitantes; a outra verifica se a interface oferece condições para realizá-la.

## 2. Contexto e verificações existentes

O projeto já possui:

- TypeScript, com `npm run typecheck`.
- Vitest, testes de interface, API e regras, com `npm test`.
- Testes de fronteiras arquiteturais, com `npm run test:architecture`.
- Testes de integração com PostgreSQL, com `npm run test:db`.
- Smoke do executável compilado, SPA, mídias e API, com `npm run smoke:production`.
- Workflow de deploy em `.github/workflows/deploy.yml`, que executa typecheck e testes antes de publicar.

Essas verificações não incluem uma auditoria de desempenho Lighthouse nem uma suíte dedicada de navegação em navegador real. O smoke de produção utiliza requisições HTTP e não substitui essa navegação.

Características relevantes do jogo:

- Interface disponível a partir de 720 px; em telas menores, a raiz apresenta um aviso e link para `/sobre/`.
- `/sobre/` é uma página pública com entrada HTML própria, acessível em mobile e sem JavaScript.
- Telas internas controladas por estado React, sem URLs próprias na maior parte da aplicação.
- Vídeos de fundo, imagens e áudio com possível impacto no carregamento e no consumo de recursos.
- Carregamento tardio da tela de batalha, já existente.
- Temporizadores, espera da IA e polling de batalhas que precisam ser considerados na automação.

## 3. Ferramentas recomendadas

| Ferramenta | Responsabilidade |
|---|---|
| **Lighthouse CI** | Carregamento, acessibilidade automatizada, boas práticas e SEO das páginas públicas |
| **Playwright** | Funcionamento dos fluxos principais no navegador real |
| **axe-core integrado ao Playwright** | Acessibilidade automatizada das telas internas e estados alcançados pela navegação |
| **Chrome DevTools, sob demanda** | Diagnóstico de travamentos, renderização, rede e consumo de recursos |

**Recomendação:** Lighthouse CI para as entradas públicas e uma suíte curta de Playwright com axe-core para os estados internos mais relevantes.

Uma boa nota no Lighthouse não comprova a qualidade de uma batalha. A auditoria de carregamento da raiz também não percorre automaticamente menu, equipe, campanha ou combate.

## 4. Cobertura mínima

### 4.1. Páginas públicas com Lighthouse

| Página/cenário | Perfil | Verificação |
|---|---|---|
| `/`, interface inicial do jogo | Desktop | Performance, acessibilidade, boas práticas e SEO |
| `/sobre/` | Desktop | Performance, acessibilidade, boas práticas e SEO |
| `/sobre/` | Mobile | Performance, acessibilidade, boas práticas e SEO |

Executar mobile e desktop em configurações ou saídas separadas, para não misturar medianas do mesmo endereço com perfis diferentes.

Na raiz com viewport mobile, verificar funcionalmente o aviso e o acesso à apresentação. Medir apenas esse estado com Lighthouse avaliaria principalmente o aviso, não a experiência de jogar. Não exigir nota SEO de uma URL de aviso deliberadamente marcada como `noindex`.

### 4.2. Fluxos internos com Playwright

1. Abrir a página inicial e acessar autenticação.
2. Autenticar uma conta de teste e chegar ao menu.
3. Selecionar equipe, iniciar batalha e enviar um turno, verificando a atualização confirmada pelo servidor.
4. Abrir e fechar um modal, verificando foco, teclado e retorno do foco ao acionador.
5. Em largura inferior a 720 px, conferir o aviso e o link para `/sobre/`.

Executar axe-core nas telas estáveis mais importantes: autenticação, menu e batalha. Incluir um modal aberto na cobertura de acessibilidade.

Os testes precisam controlar estado inicial e dados da conta. Aguardar condições observáveis da interface e respostas esperadas, evitando esperas fixas frágeis para temporizadores, animações e ações da IA.

Como as telas internas não possuem rotas próprias, login e navegação devem ocorrer pela interface. Salvar apenas o cookie e recarregar `/` não garante que o jogo reabra diretamente no menu ou na batalha.

## 5. Execução proposta no CI

Criar um workflow dedicado, por exemplo `.github/workflows/frontend-quality.yml`:

1. Instalar dependências a partir do lockfile e Chromium com suas dependências de sistema.
2. Disponibilizar PostgreSQL descartável, aplicar migrations e preparar dados de teste.
3. Gerar o build de produção com `npm run build`.
4. Iniciar a aplicação compilada e aguardar prontidão.
5. Executar Lighthouse e os fluxos de navegador em cenários isolados.
6. Publicar relatórios HTML/JSON, screenshots e traces de falhas como artefatos, inclusive quando alguma verificação falhar.

Usar o build compilado mantém a medição próxima da publicação real. Um servidor estático do diretório de build não reproduz sozinho a API, autenticação e comportamento HTTP da aplicação.

### Requisitos de ambiente

- Node e ferramentas com versões fixadas, compatíveis com o projeto.
- PostgreSQL exclusivo para o CI; se reutilizar ferramentas que exigem `TEST_DATABASE_URL`, respeitar o sufixo `_test` e a separação do banco de desenvolvimento.
- Contas e dados sintéticos, sem credenciais ou sessões reais nos artefatos.
- `APP_ORIGIN` igual à origem utilizada pelo navegador para que as mutações sejam aceitas.
- Estratégia explícita para autenticação: em modo de produção os cookies são `Secure`. Preferir HTTPS local com configuração adequada do navegador, ou documentar uma execução do build em ambiente de teste compatível com cookies HTTP. Não enfraquecer o comportamento de produção para acomodar o teste.
- Analytics de produção desativado durante as execuções.
- Dados preparados antes de cada fluxo e isolamento entre cenários para evitar disputa pela mesma conta/equipe/batalha.

### Disparo e armazenamento

- Executar em pull requests, pushes relevantes para frontend/shared/backend, configuração de build e dependências, além de permitir execução manual.
- Fazer três execuções Lighthouse por cenário e usar a mediana explicitamente nas assertions.
- Manter perfis de viewport, rede e CPU fixos para permitir comparação.
- Rodar medições de desempenho sem concorrência pesada no mesmo runner.
- Salvar relatórios localmente pelo Lighthouse CI e publicá-los como artefatos do GitHub Actions por 14 dias, sem servidor Lighthouse dedicado inicialmente.
- Começar com desempenho em modo informativo enquanto se estabelece a linha de base.

Um workflow separado não bloqueia automaticamente o deploy existente. Quando os critérios forem estáveis, configurar checks obrigatórios na proteção da branch e dependências no pipeline de publicação para que as verificações escolhidas sejam efetivamente exigidas antes do deploy.

## 6. Metas e política de regressão

Estas são metas de partida, não resultados já medidos:

| Indicador | Meta inicial |
|---|---|
| Lighthouse Performance: entrada desktop do jogo | ≥ 85 |
| Lighthouse Performance: `/sobre/` | ≥ 90, por perfil |
| Lighthouse Accessibility | ≥ 95, acompanhada da revisão dos problemas individuais |
| Lighthouse Best Practices | ≥ 95 |
| Lighthouse SEO | ≥ 95 nas páginas públicas indexáveis |
| axe-core | Nenhuma violação crítica ou séria nos cenários cobertos |
| Navegação | Todos os fluxos mínimos aprovados |

### Evolução dos limites

1. Registrar a primeira linha de base por cenário, commit e versão de ferramenta.
2. Investigar variação entre execuções antes de adotar uma nota como bloqueio.
3. Definir limites de transferência inicial de JavaScript, CSS e mídia a partir dos valores medidos e das necessidades visuais do jogo.
4. Escolher limites de regressão para métricas de carregamento e recursos; documentar exceções com justificativa e revisão.
5. Tornar bloqueantes os fluxos funcionais e violações graves de acessibilidade; promover os limites de desempenho quando estáveis.

Uma nota agregada não substitui a análise de problemas individuais. Auditoria automatizada de acessibilidade também não comprova conformidade integral ou usabilidade por teclado/leitor de tela.

## 7. Experiência real e Core Web Vitals

As referências de boa experiência para dados reais são:

| Métrica | O que indica | Referência |
|---|---|---|
| LCP | Carregamento do maior conteúdo visível | ≤ 2,5 s |
| INP | Resposta às interações | ≤ 200 ms |
| CLS | Estabilidade visual | ≤ 0,1 |

Avaliar no percentil 75, separando mobile e desktop e considerando o volume de amostras. Essas referências não são diretamente intercambiáveis com notas de laboratório.

O Lighthouse tradicional de carregamento não mede o INP real dos jogadores; utiliza TBT como sinal de bloqueio da thread principal. Uma boa medição inicial não descreve sozinha a responsividade durante uma partida longa.

Após a implantação mínima, considerar `web-vitals` com destino de coleta definido, ou CloudWatch RUM para investigação de desempenho e erros reais. A coleta em produção deve seguir as decisões de consentimento, dados e orçamento da [proposta de analytics](analytics.md).

Os relatórios públicos de campo do PageSpeed Insights e Search Console dependem de volume e elegibilidade no Chrome User Experience Report. Ausência desses dados não indica que o jogo esteja rápido ou lento.

Como a navegação interna ocorre por estado, não presumir que cada tela receba automaticamente um conjunto independente de Core Web Vitals. Para medir prontidão da batalha ou tempo de resposta de ações específicas, podem ser necessárias marcações próprias em uma evolução posterior.

## 8. Pontos específicos para a primeira análise

- Peso e momento de carregamento dos vídeos de fundo.
- Imagens e áudios baixados antes de serem necessários.
- Efeito do carregamento tardio da tela de batalha.
- Responsividade ao selecionar habilidades e montar combos.
- Custo de renderizações, temporizadores e polling durante partidas.
- Contraste de textos e indicadores sobre cenários animados.
- Navegação por teclado, foco visível e comportamento dos modais.
- Respeito a movimento reduzido, pausa em abas ocultas e fallback estático dos vídeos.
- Estabilidade da interface durante carregamento de fontes, imagens e mudanças de estado.

Complementar a automação com uma revisão manual curta de teclado, foco, legibilidade e movimento reduzido nas telas principais.

## 9. Entregáveis e critérios de aceite

- [ ] Configurações versionadas do Lighthouse CI, Playwright e integração axe-core.
- [ ] Workflow executando sobre o build compilado e dados descartáveis.
- [ ] Relatórios reproduzíveis para `/` desktop e `/sobre/` desktop/mobile.
- [ ] Fluxos mínimos desktop e aviso de tela estreita aprovados.
- [ ] Falhas com relatórios, screenshots ou traces úteis para diagnóstico.
- [ ] Linha de base registrada por cenário, com ferramentas e condições de execução.
- [ ] Política explícita sobre checks informativos e bloqueantes.
- [ ] Documentação dos comandos locais, pré-requisitos e interpretação dos resultados após a implementação.

## 10. Custo, esforço e implantação por etapas

**Custo incremental:** ferramentas sem licença; consumo de minutos e armazenamento do GitHub Actions conforme o plano. Não é necessário manter um serviço novo na instância Lightsail para executar essas verificações.

**Esforço estimado:** 1–2 dias para configuração, cenários mínimos e linha de base, assumindo preparação simples dos dados e do ambiente. Correções encontradas nas auditorias serão dimensionadas após a medição.

### Sequência sugerida

1. Preparar ambiente descartável e medir a linha de base das páginas públicas.
2. Adicionar os fluxos mínimos Playwright e axe-core.
3. Publicar relatórios no CI e corrigir os problemas prioritários identificados.
4. Estabilizar os limites e conectar os checks bloqueantes à publicação.
5. Reavaliar a necessidade de telemetria real conforme o uso do jogo.

O [monitoramento de infraestrutura](deploy/monitoring.md) continua cobrindo disponibilidade e saúde do serviço; as verificações aqui propostas acrescentam qualidade da interface e da experiência no navegador.

## 11. Referências

- [Lighthouse CI: configuração](https://googlechrome.github.io/lighthouse-ci/docs/configuration.html).
- [Playwright: integração contínua](https://playwright.dev/docs/ci).
- [Playwright: testes de acessibilidade com axe-core](https://playwright.dev/docs/accessibility-testing).
- [Core Web Vitals](https://web.dev/articles/vitals).
- [PageSpeed Insights](https://pagespeed.web.dev/).
- [Chrome DevTools: painel Performance](https://developer.chrome.com/docs/devtools/performance).
