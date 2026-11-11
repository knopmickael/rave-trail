import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import type { HtmlTagDescriptor, Plugin } from 'vite';
import { TitleScreen } from './src/components/TitleScreen';
import { site } from './src/seo';
import { AboutApp, ABOUT_TITLE } from './src/components/AboutPage';

const absolute = (path: string) => new URL(path, site.url).href;

export function seo(): Plugin {
  return {
    name: 'rave-trail-seo',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        const about = context.path === '/sobre/index.html' || context.path === '/sobre/';
        const url = about ? absolute('/sobre/') : site.url;
        const title = about ? ABOUT_TITLE : site.title;
        const description = about
          ? 'Conheça Rave Trail (rave-trail ou ravetrail): um RPG de navegador com campanhas de fantasia, equipes de personagens e combate estratégico por turnos.'
          : site.description;
        const graph: Record<string, unknown>[] = [
          { '@type': 'WebSite', '@id': absolute('/#website'), url: site.url, name: site.name,
            alternateName: site.alternateNames, inLanguage: 'pt-BR', description: site.description },
          { '@type': 'VideoGame', '@id': absolute('/#game'), url: site.url, name: site.name,
            alternateName: site.alternateNames, description: site.introduction, inLanguage: 'pt-BR',
            genre: ['RPG', 'Estratégia por turnos', 'Fantasia'], gamePlatform: 'Navegador web',
            operatingSystem: 'Navegador de computador', applicationCategory: 'GameApplication',
            playMode: 'https://schema.org/SinglePlayer', image: absolute(site.socialImage) },
          { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title, description,
            inLanguage: 'pt-BR', isPartOf: { '@id': absolute('/#website') },
            about: { '@id': absolute('/#game') }, primaryImageOfPage: { '@id': absolute('/#social-image') } },
          { '@type': 'ImageObject', '@id': absolute('/#social-image'), url: absolute(site.socialImage),
            width: 1200, height: 630, caption: 'Rave Trail — RPG de fantasia e estratégia por turnos' },
        ];
        if (about) graph.push({ '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: site.name, item: site.url },
          { '@type': 'ListItem', position: 2, name: 'Sobre o jogo', item: url },
        ] });
        const meta = (name: string, content: string): HtmlTagDescriptor => ({ tag: 'meta', attrs: { name, content } });
        const property = (name: string, content: string): HtmlTagDescriptor => ({ tag: 'meta', attrs: { property: name, content } });
        const tags: HtmlTagDescriptor[] = [
          meta('description', description), meta('robots', 'index, follow, max-image-preview:large'),
          { tag: 'link', attrs: { rel: 'canonical', href: url } },
          { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/favicon.png' } },
          { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' } },
          { tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' } },
          property('og:type', 'website'), property('og:site_name', site.name), property('og:locale', 'pt_BR'),
          property('og:title', title), property('og:description', description), property('og:url', url),
          property('og:image', absolute(site.socialImage)), property('og:image:type', 'image/jpeg'),
          property('og:image:width', '1200'), property('og:image:height', '630'),
          property('og:image:alt', 'Rave Trail — RPG de fantasia e estratégia por turnos'),
          meta('twitter:card', 'summary_large_image'), meta('twitter:title', title), meta('twitter:description', description),
          meta('twitter:image', absolute(site.socialImage)), meta('twitter:image:alt', 'Rave Trail — RPG de fantasia e estratégia por turnos'),
          { tag: 'script', attrs: { type: 'application/ld+json' },
            children: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c') },
        ];
        return {
          html: html.replace('<title>Rave Trail</title>', `<title>${title}</title>`)
            .replace('<!--about-html-->', about ? renderToString(createElement(AboutApp)) : '')
            .replace('<!--app-html-->', about ? '' : renderToStaticMarkup(createElement(TitleScreen, { checking: true }))),
          tags,
        };
      },
    },
  };
}
