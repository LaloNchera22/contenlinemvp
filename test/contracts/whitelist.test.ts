import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * isWhitelistedContract lee las direcciones de env AL IMPORTAR el módulo
 * (constante CONTRACTS). Por eso cada escenario ajusta process.env, resetea el
 * caché de módulos y reimporta, para evaluar la whitelist en ese estado concreto.
 */
const SUB = '0x1111111111111111111111111111111111111111';
const PAY = '0x2222222222222222222222222222222222222222';

async function importWith(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules();
  return import('@/lib/contracts');
}

afterEach(() => {
  vi.resetModules();
});

describe('isWhitelistedContract', () => {
  it('lanza error si la whitelist está vacía (entorno mal configurado)', async () => {
    const { isWhitelistedContract } = await importWith({
      NEXT_PUBLIC_CONTRACT_SUBSCRIPTION: '',
      NEXT_PUBLIC_CONTRACT_PAYMENT: '',
    });
    expect(() => isWhitelistedContract(SUB)).toThrow(/whitelist/i);
  });

  it('acepta direcciones whitelisteadas sin importar mayúsculas/minúsculas', async () => {
    const { isWhitelistedContract } = await importWith({
      NEXT_PUBLIC_CONTRACT_SUBSCRIPTION: SUB,
      NEXT_PUBLIC_CONTRACT_PAYMENT: PAY,
    });
    expect(isWhitelistedContract(SUB.toLowerCase())).toBe(true);
    expect(isWhitelistedContract(SUB.toUpperCase().replace('0X', '0x'))).toBe(true);
    expect(isWhitelistedContract(PAY)).toBe(true);
  });

  it('rechaza una dirección no whitelisteada', async () => {
    const { isWhitelistedContract } = await importWith({
      NEXT_PUBLIC_CONTRACT_SUBSCRIPTION: SUB,
      NEXT_PUBLIC_CONTRACT_PAYMENT: PAY,
    });
    expect(isWhitelistedContract('0x9999999999999999999999999999999999999999')).toBe(false);
  });
});
