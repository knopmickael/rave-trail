# Migrations automáticas do CMS local

## Objetivo
Cada mutação confirmada no perfil `local` produz uma migration SQL imutável em
`backend/migrations/`. Trocar o skillset de um personagem deve atualizar o banco
local e gerar o SQL que o CI/CD aplicará em produção após commit/push.

## Abordagem
Registrar as instruções de escrita executadas pelo repositório, com parâmetros
serializados em literais PostgreSQL. Isso mantém o comportamento de autoria e de
replay no mesmo código, incluindo relacionamentos e `cms_content_overrides`.
Uma tabela de journal guarda o SQL e o nome na mesma transação do conteúdo e de
`schema_migrations`. Depois do commit, o arquivo é exportado. Uma falha de disco
é reportada como conteúdo salvo com exportação pendente; abrir o CMS novamente
ou repetir a consulta de status recupera os arquivos pendentes sem repetir a edição.

Alternativas consideradas: repetir edições em produção é manual; exportar um
snapshot inteiro inclui alterações não relacionadas; gerar SQL separado por
formulário duplica as regras existentes. A captura das escritas é a escolha de
implementação para o fluxo automático solicitado.

## Escopo e limites
- Somente `CMS_PROFILE=local` habilita geração. Perfis prod e legado continuam diretos.
- Incluir CRUD de entidades, ordem do catálogo, setups e uploads binários.
- Não exportar IDs/dados de jogadores locais. Efeitos de desabilitação são SQL
  baseado nos jogadores e confrontos do banco de destino.
- Exclusões devem revalidar referências históricas no destino e falhar atomicamente.
- Reordenações validam o conjunto de IDs no destino antes de modificar posições;
  divergências abortam a migration inteira, preservando registros adicionais.
- Nomes ordenados depois das migrations atuais; nunca sobrescrever arquivo diferente.
- Um save sem sucesso não produz migration. Arquivos gerados devem ser commitados;
  não há push/deploy automático. Edições anteriores à implementação não são capturadas.
- SQL representa a operação salva, não merge de edições concorrentes em produção.
- Em banco novo sem o catálogo base e sem autoria de personagens, o migrador
  prepara o catálogo compartilhado antes de executar SQL gerado pelo CMS.

## Verificação
Testes reais em banco exclusivo `_test`: salvar skillset, aplicar o arquivo em
outro schema com o migrador de produção e verificar slots, seed, uploads,
reordenação, exclusão, desabilitação e recuperação após falha de escrita.
