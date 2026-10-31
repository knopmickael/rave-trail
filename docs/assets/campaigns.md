# Imagens temporárias de campanha

Arquivos em `frontend/public/media/campaigns/`; ferramenta de autoria em `tools/assets/generate-campaign-art.mjs`.

`path-1.webp` e `path-2.webp` são derivados do cenário original de clareira já fornecido no projeto. Cada capítulo tem seu próprio arquivo e caminho persistido na tabela `campaigns`. Esses arquivos são os fundos dos cards; a página de seleção usa o mesmo céu compartilhado do menu e da Lista de personagens.

Regeneração: `npm run assets:campaigns`, com Sharp disponível como ferramenta de autoria ou com `SHARP_PATH` configurado. O jogo utiliza os arquivos prontos e não depende de Sharp em runtime.
