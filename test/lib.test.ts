import { describe, it, expect, beforeAll } from 'vitest';
import { calculateFee } from '../lib/fees';
import { isSafeWebhookUrl } from '../lib/webhook';
import { isSafeHttpsUrl } from '../lib/url';

describe('calculateFee', () => {
  it('aplica 10% a suscripción y curso', () => {
    expect(calculateFee(100, 'subscription')).toEqual({
      feePercent: 0.1,
      feeAmount: 10,
      netAmount: 90,
    });
    expect(calculateFee(50, 'course').feeAmount).toBe(5);
  });

  it('aplica 3% a servicio y onchain', () => {
    expect(calculateFee(100, 'service').feeAmount).toBe(3);
    expect(calculateFee(100, 'onchain').netAmount).toBe(97);
  });

  it('redondea a 6 decimales (precisión USDC)', () => {
    const { feeAmount } = calculateFee(0.000001, 'onchain');
    expect(feeAmount).toBe(0);
  });
});

describe('isSafeWebhookUrl', () => {
  it('acepta https público', () => {
    expect(isSafeWebhookUrl('https://example.com/hook')).toBe(true);
  });

  it('rechaza http, localhost, IPs privadas y metadata cloud', () => {
    expect(isSafeWebhookUrl('http://example.com')).toBe(false);
    expect(isSafeWebhookUrl('https://localhost/x')).toBe(false);
    expect(isSafeWebhookUrl('https://127.0.0.1')).toBe(false);
    expect(isSafeWebhookUrl('https://10.0.0.5')).toBe(false);
    expect(isSafeWebhookUrl('https://192.168.1.1')).toBe(false);
    expect(isSafeWebhookUrl('https://169.254.169.254')).toBe(false);
    expect(isSafeWebhookUrl('https://[::1]')).toBe(false);
    expect(isSafeWebhookUrl('not a url')).toBe(false);
  });
});

describe('isSafeHttpsUrl', () => {
  it('acepta solo https y rechaza javascript:/data:', () => {
    expect(isSafeHttpsUrl('https://cdn.example.com/a.png')).toBe(true);
    expect(isSafeHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpsUrl('data:text/html,<script>')).toBe(false);
    expect(isSafeHttpsUrl('http://example.com')).toBe(false);
    expect(isSafeHttpsUrl(null)).toBe(false);
  });
});

describe('verifySupabaseJwt', () => {
  beforeAll(() => {
    process.env.SUPABASE_JWT_SECRET = 'test-secret-test-secret-test-secret';
  });

  it('verifica un token válido y rechaza firmas/longitudes inválidas', async () => {
    // Import diferido: jwt lee el secret al ejecutarse.
    const { signSupabaseJwt, verifySupabaseJwt } = await import('../lib/jwt');
    const token = signSupabaseJwt({ sub: 'u1', wallet: '0xabc', role: 'authenticated' });
    const claims = verifySupabaseJwt(token);
    expect(claims?.sub).toBe('u1');

    expect(verifySupabaseJwt('a.b.c')).toBeNull();
    expect(verifySupabaseJwt(token + 'tampered')).toBeNull();
    expect(verifySupabaseJwt('only.two')).toBeNull();
  });
});
