# Novo Quadro de missões

Spec: `todo-list.md` (27 personagens). Implementar na branch `develop`, verificar,
commitar todas as alterações desta tarefa e fazer push para `github/develop`.

## Decisões
- Manter IDs, assets, equipes, desbloqueios conquistados e pontos de revelação
  existentes. Só Exal final e Zéfiro recebem revelação obrigatória após batalha 7.
- Remover objetivos redundantes de campanha das missões listadas: a campanha é o
  ponto de revelação; os objetivos descritos são de Batalha rápida.
- Manter Exal final e Zéfiro com `unlock.kind=premium` e preço, permitindo também
  `unlock_rule`. O quadro retorna missão com preço opcional; Premium sem missão
  permanece fora do quadro. Não implementar um checkout novo.
- Grupos explícitos: seis Saqueadores, três de Pontes, sete versões de Grimória
  (inclui Exal final), três de Espinea. Um membro do grupo satisfaz a condição.
- `requireNoDeaths` exige vitória sem nenhuma derrota de aliado, inclusive quem
  ressuscitou. Registrar o fato no estado autoritativo e preservá-lo na compactação.
  Histórico sem esse dado não será presumido como vitória sem mortes.
- Renomear somente Ravi Berserk para Ravi Berzerk, preservando os caminhos dos assets.
- Migration 056 atualiza requisitos dos IDs listados e preserva metadados, autoria
  de outros personagens, preços e progresso; seed respeita edições posteriores.

## Fronteiras de verificação
- Motor e `characterUnlockProgress`: derrota/ressurreição, contagem AND/OR, limites,
  grupos, requisito sem mortes, modos e revelação. Não substitui persistência real.
- Repositórios/CMS/Postgres: migration, preços+missões, concessão, compactação,
  idempotência e preservação. Não depende de pagamento externo.
- Interface: quadro com ambos os Premium e CMS com condição sem mortes/dupla via.

## Passos
1. Testes de contagem e novos contratos, implementação das 27 regras e nomes.
2. Rastrear mortes no motor, resumo persistido e leitura de vitórias.
3. Habilitar Premium com missão no backend, CMS e apresentação; testes integrados.
4. Migration 056, traduções, docs e atualização do todo-list.
5. Typecheck, testes focados, suítes completas, build e revisão independente.
6. Conferir status/diff/log, commitar arquivos da tarefa e fazer push para develop.

## Registro de execução
- Implementadas as 27 regras e a dupla via Premium/missão sem novos IDs de unidades.
- Estado autoritativo de derrota preservado após ressurreição, leitura e compactação;
  o teste usa contagem sem saturar o limite antes de adicionar as vitórias finais.
- Revisão independente: ajustada a migration para mesclar metadados alheios de
  `unlock_rule`; teste de anotação de autoria falhou antes e passou após a correção.
- Fixtures históricas que reaplicam migrations antigas agora reaplicam a 056
  quando precisam comparar com o quadro atual, preservando a ordem real de deploy.
- Verificações finais: 445 testes gerais, 152 testes de banco, typecheck e build.
- O Docker estava desligado ao retomar a sessão; iniciado e aguardada a saúde do
  PostgreSQL antes da suíte final. Nenhum banco foi resetado nesta tarefa.
- Migration 056 aplicada ao banco local e CMS reiniciado pelo App Hub. Conferência
  no navegador em 1440px/390px: Premium+missão ativos, batalha 7 configurada e condição
  sem mortes marcada na segunda meta de Zéfiro, sem overflow ou erros de página.
