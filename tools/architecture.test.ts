import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBuiltin } from 'node:module';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { assets } from '../frontend/src/assets';
import { units } from '@game/content/units';
import { abilities } from '@game/content/abilities';
import { campaigns } from '@game/content/campaigns';

const root = fileURLToPath(new URL('../', import.meta.url));
const layers = ['frontend', 'backend', 'shared'] as const;
type Layer = typeof layers[number];
const normalize = (path: string) => path.replaceAll('\\', '/').toLowerCase();
function layerOf(path: string): Layer | undefined {
  return layers.find((layer) => normalize(path).startsWith(normalize(join(root, layer, 'src')) + '/'));
}

async function sources(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? sources(join(directory, entry.name))
    : /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [join(directory, entry.name)] : []))).flat();
}

it('mantém as dependências entre camadas direcionadas ao código compartilhado', async () => {
  const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const violations: string[] = [];
  for (const layer of layers) {
    for (const file of await sources(join(root, layer, 'src'))) {
      const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
      const imports: string[] = [];
      const visit = (node: ts.Node) => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
          || ts.isIdentifier(node.expression) && node.expression.text === 'require') && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
        ts.forEachChild(node, visit);
      };
      visit(source);
      for (const dependency of imports) {
        const resolved = ts.resolveModuleName(dependency, file, parsed.options, ts.sys).resolvedModule?.resolvedFileName;
        const target = resolved ? layerOf(resolve(resolved)) : undefined;
        const forbiddenLayer = target && target !== layer && target !== 'shared';
        const forbiddenExternal = layer === 'shared' && !dependency.startsWith('.') && !dependency.startsWith('@game/')
          || layer === 'frontend' && (isBuiltin(dependency) || /^(pg(?:\/|$)|fastify(?:\/|$)|dotenv(?:\/|$)|@fastify\/)/.test(dependency))
          || layer === 'backend' && /^(react(?:\/|$)|react-dom(?:\/|$)|vite(?:\/|$))/.test(dependency);
        if (forbiddenLayer || forbiddenExternal) violations.push(`${relative(root, file)} -> ${dependency}`);
      }
    }
  }
  expect(violations, 'Frontend/backend não podem importar um ao outro; shared não depende de frameworks ou I/O.').toEqual([]);
});

it('resolve todos os caminhos de mídia para uma única árvore de arquivos públicos', async () => {
  const paths = [...Object.values(assets), ...units.flatMap((unit) => [unit.portrait, unit.illustration]),
    ...Object.values(abilities).map((ability) => ability.icon), ...campaigns.map((campaign) => campaign.background)];
  for (const path of new Set(paths)) {
    expect(path).toMatch(/^\/media\//);
    const file = resolve(root, 'frontend/public', `.${decodeURI(path)}`);
    expect(normalize(file).startsWith(normalize(join(root, 'frontend/public/media')) + '/')).toBe(true);
    expect((await stat(file)).isFile(), `${path} precisa existir no diretório público do frontend.`).toBe(true);
    expect(await readdir(dirname(file)), `${path} precisa ter a mesma capitalização em disco.`).toContain(basename(file));
  }
});

it('separa migrações, ferramentas, referências e fontes das saídas geradas', async () => {
  const directories = await readdir(root);
  for (const old of ['src', 'server', 'public', 'assets', 'scripts', 'build', 'dist']) expect(directories).not.toContain(old);
  for (const path of ['frontend/src', 'frontend/public/media', 'backend/src', 'backend/migrations', 'shared/src', 'tools/assets', 'docs/design/templates']) {
    expect((await stat(join(root, path))).isDirectory()).toBe(true);
  }
});
