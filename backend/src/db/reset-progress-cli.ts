import { createInterface } from 'node:readline/promises';
import { config as loadEnvironment } from 'dotenv';
import pg from 'pg';
import { environmentPath } from '../paths.js';
import { resetPlayerProgress } from './reset-progress.js';

const usage = `Uso: npm run db:reset-progress -- <email> [--yes]

Zera o progresso da conta informada:
- campanha, caminhos, personagens, missões e histórico de batalhas;
- equipe selecionada;
- preferências voltam aos valores iniciais.

A conta, a senha, o nome e as sessões são preservados.`;

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((argument) => !argument.startsWith('-'));
  const confirmed = args.includes('--yes');
  if (!email || args.includes('--help') || args.includes('-h')) {
    console.info(usage);
    if (!email) process.exitCode = 1;
    return;
  }
  if (!confirmed) {
    if (!process.stdin.isTTY) {
      console.error('Confirmação necessária. Execute novamente com --yes.');
      process.exitCode = 1;
      return;
    }
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await terminal.question(`Zerar todo o progresso de ${email}? [s/N] `);
    terminal.close();
    if (!/^s(im)?$/i.test(answer.trim())) {
      console.info('Operação cancelada.');
      return;
    }
  }

  loadEnvironment({ path: environmentPath });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await resetPlayerProgress(pool, email);
    console.info(`Progresso zerado para ${result.email} (${result.userId}).`);
    console.info(`Batalhas removidas: ${result.battlesDeleted}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
