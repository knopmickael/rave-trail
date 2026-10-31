import { describe, expect, it } from 'vitest';
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from './crypto.js';

describe('credenciais', () => {
  it('usa salt individual e verifica senhas sem remover espaços', async () => {
    const password = ' senha com espaços ';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword(password.trim(), first)).toBe(false);
    expect(await verifyPassword('outra senha', first)).toBe(false);
    expect(await verifyPassword(password, 'hash inválido')).toBe(false);
  });

  it('gera tokens independentes de 256 bits e hashes estáveis', () => {
    const token = createSessionToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(createSessionToken()).not.toBe(token);
    expect(hashSessionToken(token)).not.toBe(token);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });
});
