import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { calculateFee } from '../lib/fees';
import { isSafeWebhookUrl, fireWebhook } from '../lib/webhook';
import { isSafeHttpsUrl } from '../lib/url';
import { monthlyValue, summarizeSubscribers } from '../lib/subscribers';

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

describe('fireWebhook', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('lanza (fallo cerrado) si faltan las env vars de Supabase', async () => {
    await expect(fireWebhook('sess-1', 'https://example.com/h')).rejects.toThrow(
      /env vars/i,
    );
  });

  it('invoca process-webhook con el service key y el sessionId', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    await fireWebhook('sess-1', 'https://example.com/h');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://proj.supabase.co/functions/v1/process-webhook');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer svc-key',
    });
    expect((init as RequestInit).body).toContain('sess-1');
  });

  it('lanza si process-webhook responde no-2xx', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('err', { status: 500 }));
    await expect(fireWebhook('s', 'https://example.com/h')).rejects.toThrow(/500/);
  });
});

describe('subscribers metrics', () => {
  it('monthlyValue normaliza anual a mensual y descarta no positivos', () => {
    expect(monthlyValue(12, 'yearly')).toBe(1);
    expect(monthlyValue(9.99, 'monthly')).toBe(9.99);
    expect(monthlyValue(null, 'monthly')).toBe(0);
    expect(monthlyValue(0, 'yearly')).toBe(0);
  });

  it('summarizeSubscribers calcula MRR, expiraciones y tasa de renovación', () => {
    const now = new Date('2026-06-17T00:00:00Z').getTime();
    const days = (n: number) => new Date(now + n * 24 * 60 * 60 * 1000).toISOString();
    const ago = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

    const active = [
      // vence en 3 días (cuenta como expiringSoon) y lleva 45 días → renovado
      { plan_price_usdc: 10, plan_interval: 'monthly' as const, started_at: ago(45), expires_at: days(3) },
      // anual a $120 → $10/mes; nuevo (5 días) → no renovado; vence lejos
      { plan_price_usdc: 120, plan_interval: 'yearly' as const, started_at: ago(5), expires_at: days(300) },
    ];
    const m = summarizeSubscribers(active, now);
    expect(m.activeCount).toBe(2);
    expect(m.mrr).toBe(20); // 10 + 120/12
    expect(m.expiringSoon).toBe(1);
    expect(m.renewalRate).toBe(50); // 1 de 2
  });

  it('summarizeSubscribers no divide por cero con lista vacía', () => {
    expect(summarizeSubscribers([])).toEqual({
      activeCount: 0,
      mrr: 0,
      expiringSoon: 0,
      renewalRate: 0,
    });
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
