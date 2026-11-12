# Site alterações

1. [x] Trocar o favicon pelo logo oficial do game que é usado nos menus.

# CMS alterações

1. [x] Troque o conteúdo de "01 Uma nova jornada por: 01 Metadados".

2. [x] A descrição da campanha não aparece em lugar algum do site/jogo e ela não está refletindo de fato a descrição que é mostrada ao clicar no ícone de pergaminho no mapa da campanha - sincronize-os.

3. [x] Ao clicar em "Campanha publicada / disponível no jogo" não está refletindo no site/jogo, continua desabilitada (somente a campanha 2, a campanha está refletindo normalmente).

4. [x] Por algum motivo, a imagem de fundo (mapa) de ambas as campanhas aparece como vazia no form, deveria estar aparecendo o caminho /media/images/mapa-campanha-01.png que inclusive está incorreto, afinal deveria estar em /media/campaigns/ e não /media/images. Pode colocar o mapa-campanha-01.png como imagem de fundo de ambas as campanhas atuais (01 e 02).

5. [x] Lembrando que TODAS opções de Salvamento/Exclusão/Edição precisam de Confirmação do usuário.

6. [x] Fica complicado de definir a ordem do Personagem no catálogo dentro do formulário do personagem, seria melhor se a disposição dos personagens fosse em lista e eu pudesse fazer um drag and drop deles ou até mesmo um botão que sobe/desce o personagem de posição na lista (o que reflete diretamente na ordem do personagem na Lista de personagens do jogo/site).

7. [x] Remova a opção "conteúdo provisório" de TODAS entidades do sistema, não estamos trabalhando com essa lógica em hipótese alguma.

8. [x] Ainda no formulário do personagem, na parte de Leque de habilidades, seria interessante ver a imagem e os dados da habilidade sendo escolhida e quem sabe um campo de pesquisa por nome também.

9. [x] Aparentemente não precisamos do campo "Descrição do desbloqueio" dos personagens, não faz muito sentido.

10. [x] Nenhum personagem será desbloqueado através da opção existente: Concluir uma batalha. As opções atuais de desbloqueio são exclusivamente: Disponível desde o início, Premium e Missão com requisitos, que é a única que possui o setup de "Quando revelar a lista de requisitos" que por sua vez somente possui 2 opções: Desde o início e Após vencer uma batalha específica de uma campanha específica.

11. [x] No formulário de habilidades, não precisa da condição de Setup reutilizável, dificilmente utilizarei isto, vou montar "na mão" sempre a habilidade.

12. [x] NENHUM confronto de campanha nenhuma deve conceder personagem algum como recompensa direta, jamais, desbloqueios são Premium ou através de cumprimento de Requisitos. Pode remover este elemento do formulário.

## Implementação

- Migração: `backend/migrations/039_cms_content_requirements.sql`.
- Detalhes de uso e atualização dos bancos: `docs/cms.md`.
- Ordenação pela lista com botões Subir/Descer; confirmações nativas do navegador nas ações de edição e persistência.
