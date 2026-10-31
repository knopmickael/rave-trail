import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url().refine((value) => /^postgres(ql)?:/.test(value)),
  APP_ORIGIN: z.string().url().refine((value) => new URL(value).origin === value, {
    message: 'Use apenas a origem, sem caminho ou barra final.',
  }),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const config = schema.parse(env);
  if (config.NODE_ENV === 'production' && !config.APP_ORIGIN.startsWith('https://')) {
    throw new Error('APP_ORIGIN deve usar HTTPS em produção.');
  }
  return config;
}
