import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeAdmin, MockResponses } from '../helpers/mockSupabase';

const state = vi.hoisted(() => ({ responses: {} as MockResponses, calls: [] as string[] }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeAdmin(state.responses, state.calls),
}));
// La API key se da por válida; aquí probamos la validación del cuerpo, no la auth.
vi.mock('@/lib/validateApiKey', () => ({
  validateApiKey: async () => ({ ok: true, key: { id: 'k1', user_id: 'u1', environment: 'test' } }),
}));

import { POST } from '@/app/api/v1/checkout/route';

function req(body: unknown) {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  state.responses = {};
  state.calls = [];
});

describe('POST /api/v1/checkout', () => {
  it('rechaza una categoría fuera del enum permitido (400)', async () => {
    const res = await POST(req({ amount_usdc: 10, category: 'subscription' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/category/i);
  });

  it('rechaza amount_usdc no positivo (400)', async () => {
    const res = await POST(req({ amount_usdc: 0, category: 'onchain' }));
    expect(res.status).toBe(400);
  });

  it('rechaza webhook_url con destino privado (SSRF) (400)', async () => {
    const res = await POST(
      req({ amount_usdc: 10, category: 'onchain', webhook_url: 'https://169.254.169.254/' }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/webhook/i);
  });

  it('rechaza metadata que excede el límite de tamaño (400)', async () => {
    const big = { blob: 'x'.repeat(5000) };
    const res = await POST(req({ amount_usdc: 10, category: 'onchain', metadata: big }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/metadata/i);
  });

  it('crea la sesión de pago en el happy path (201)', async () => {
    state.responses = {
      'select:api_keys': [{ data: { user_id: 'u1' } }],
      'insert:payment_sessions': [
        { data: { id: 's1', amount_usdc: 10, category: 'onchain', status: 'pending' } },
      ],
    };
    const res = await POST(req({ amount_usdc: 10, category: 'onchain' }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.session.id).toBe('s1');
    expect(json.checkout_url).toContain('/checkout/s1');
  });
});
