import { describe, it, expect, vi } from 'vitest';
import {
  requireString,
  optionalString,
  validatePrice,
  isValidationError,
  LIMITS,
  MAX_PRICE_USDC,
} from '@/lib/validation';
import { getChain, getRpcUrl } from '@/lib/chain';
import { generateNonce, buildSiweMessage, NONCE_TTL_MS } from '@/lib/siwe';
import { clientIp, checkIpRateLimit } from '@/lib/rateLimit';
import { generateApiKey, detectEnvironment } from '@/lib/apiKeys';

describe('validation', () => {
  it('requireString respeta longitud mínima y máxima', () => {
    expect(requireString('ab', 'name', 3, 100)).toMatchObject({ error: expect.any(String) });
    expect(requireString('x'.repeat(101), 'name', 3, 100)).toMatchObject({ error: expect.any(String) });
    expect(requireString(123, 'name', 3, 100)).toMatchObject({ error: expect.any(String) });
    expect(requireString('  hola  ', 'name', 3, 100)).toBe('hola'); // recorta
  });

  it('optionalString permite vacío y acota longitud', () => {
    expect(optionalString(undefined, 'bio', LIMITS.bio)).toBeNull();
    expect(optionalString('', 'bio', LIMITS.bio)).toBeNull();
    expect(optionalString('x'.repeat(LIMITS.bio + 1), 'bio', LIMITS.bio)).toMatchObject({
      error: expect.any(String),
    });
    expect(optionalString(' ok ', 'bio', LIMITS.bio)).toBe('ok');
  });

  it('validatePrice exige >0 y <= MAX', () => {
    expect(validatePrice(0)).toMatchObject({ error: expect.any(String) });
    expect(validatePrice(-5)).toMatchObject({ error: expect.any(String) });
    expect(validatePrice(MAX_PRICE_USDC + 1)).toMatchObject({ error: expect.any(String) });
    expect(validatePrice('abc')).toMatchObject({ error: expect.any(String) });
    expect(validatePrice(9.99)).toBe(9.99);
  });

  it('isValidationError discrimina correctamente', () => {
    expect(isValidationError({ error: 'x' })).toBe(true);
    expect(isValidationError('ok')).toBe(false);
    expect(isValidationError(null)).toBe(false);
  });
});

describe('chain', () => {
  it('default 137 → polygon mainnet', () => {
    expect(getChain().id).toBe(137);
    expect(typeof getRpcUrl()).toBe('string');
  });

  it('80001 → mumbai testnet', () => {
    const prev = process.env.NEXT_PUBLIC_CHAIN_ID;
    process.env.NEXT_PUBLIC_CHAIN_ID = '80001';
    expect(getChain().id).toBe(80001);
    process.env.NEXT_PUBLIC_CHAIN_ID = prev;
  });
});

describe('siwe', () => {
  it('genera nonces únicos y un mensaje estable', () => {
    expect(generateNonce()).not.toBe(generateNonce());
    expect(NONCE_TTL_MS).toBe(5 * 60 * 1000);
    const now = new Date('2025-01-01T00:00:00.000Z');
    const msg = buildSiweMessage({ nonce: 'abc', issuedAt: now, expiresAt: now });
    expect(msg).toContain('Nonce: abc');
    expect(msg).toContain('Contenline');
  });
});

describe('rateLimit', () => {
  it('clientIp extrae la primera IP de x-forwarded-for', () => {
    const req = { headers: { get: () => '9.9.9.9, 10.0.0.1' } };
    expect(clientIp(req)).toBe('9.9.9.9');
  });

  it('checkIpRateLimit permite (fail-open) cuando no hay IP', async () => {
    expect(await checkIpRateLimit(null, 'b', 10, 60)).toEqual({ allowed: true, count: 0 });
  });
});

describe('apiKeys', () => {
  it('genera keys con prefijo por entorno y detecta el entorno', () => {
    const prod = generateApiKey('production');
    expect(prod.fullKey.startsWith('sk_prod_')).toBe(true);
    expect(detectEnvironment(prod.fullKey)).toBe('production');
    expect(detectEnvironment(generateApiKey('test').fullKey)).toBe('test');
    expect(detectEnvironment('nope')).toBeNull();
  });
});
