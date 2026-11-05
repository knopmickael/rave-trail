# SEO do Rave Trail

O endereço canônico é **https://rave-trail.com.br/**. O nome público é **Rave Trail**, com os nomes alternativos **rave-trail** e **ravetrail**.

## O que o build publica

- `/`: apresentação pré-renderizada em HTML, antes de carregar a SPA. O mesmo componente React é usado na tela inicial, sem conteúdo diferente para robôs.
- `/sobre/`: apresentação pública, história, recursos, instruções e perguntas frequentes. Funciona sem JavaScript, conta ou largura mínima de tela.
- `/robots.txt` e `/sitemap.xml`: descoberta das duas páginas públicas.
- Títulos, descrições, URLs canônicas, Open Graph, cartões sociais e JSON-LD (`WebSite`, `WebPage`, `VideoGame`, imagem e breadcrumb da apresentação).
- Favicon e imagem social de 1200 × 630 pixels. Para regenerar as artes, use `node tools/assets/generate-seo-art.mjs` com Sharp instalado para autoria, ou indique seu módulo pela variável `SHARP_PATH`.
- URLs HTML duplicadas redirecionam com 301. URLs inexistentes retornam 404; o aviso `/acesse-pelo-computador` recebe `X-Robots-Tag: noindex, follow` quando acessado diretamente.

A interface continua exclusiva para larguras a partir de 720 px. O aviso em telas pequenas também apresenta o jogo e aponta para `/sobre/`, que é acessível aos leitores e ao rastreamento mobile. Não há identificação de robôs pelo User-Agent.

Os dados comuns ficam em `frontend/src/seo.ts`; a inserção dos metadados e o pré-render acontecem em `frontend/seo.ts`. Se o domínio mudar, atualize também os links públicos de `frontend/sobre/index.html`, `frontend/public/robots.txt`, `frontend/public/sitemap.xml` e a arte social, além da configuração de deploy.

## Após publicar

1. Cadastre `rave-trail.com.br` como propriedade de domínio no [Google Search Console](https://search.google.com/search-console/). Confirme a propriedade com o registro DNS TXT fornecido pelo Google.
2. Envie `https://rave-trail.com.br/sitemap.xml` na seção **Sitemaps**.
3. Inspecione `https://rave-trail.com.br/` e `https://rave-trail.com.br/sobre/`, confira a versão rastreada e solicite a indexação das duas URLs.
4. Cadastre o domínio no [Bing Webmaster Tools](https://www.bing.com/webmasters/) e envie o mesmo sitemap; é possível importar a propriedade do Google após verificá-la.
5. Valide as páginas com o [Schema Markup Validator](https://validator.schema.org/) e use a inspeção de URL para acompanhar o rastreamento. Não há avaliações, preços ou notas inventados nos dados estruturados.
6. Use o mesmo nome e endereço em perfis e páginas públicas do projeto e inclua links para o site. Se publicar um domínio alternativo ou `www`, configure DNS, certificado HTTPS e redirecionamento 301 para o domínio canônico.

A publicação torna as páginas elegíveis para rastreamento; envio do sitemap e melhorias técnicas não garantem prazo nem posição nos resultados. Acompanhe impressões e consultas `rave trail`, `rave-trail` e `ravetrail` no Search Console.
