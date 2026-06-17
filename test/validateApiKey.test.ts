import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeAdmin, MockResponses } from './helpers/mockSupabase';

// Estado mutable que el mock de createAdminClient lee en cada llamada. Se
// reasigna en beforeEach/por test. vi.hoisted permite referenciarlo desde la
// factory de vi.mock (que se eleva por encima del módulo).
const state = vi.hoisted(() => ({ responses: {} as MockResponses, calls: [] as string[] }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeAdmin(state.responses, state.calls),
}));

import { validateApiKey } from '@/lib/validateApiKey';
import { generateApiKey, hashApiKey } from '@/lib/apiKeys';

const VALID_KEY = generateApiKey('test').fullKey; // sk_test_...
const keyRow = { data: { id: 'k1', user_id: 'u1', environment: 'test', active: true } };

beforeEach(() => {
  state.responses = {};
  state.calls = [];
});

describe('validateApiKey', () => {
  it('rechaza si falta Bearer o el prefijo es incorrecto (401)', async () => {
    expect(await validateApiKey(null, { endpoint: '/x' })).toMatchObject({ ok: false, status: 401 });
    expect(await validateApiKey('Bearer no_prefix_key', { endpoint: '/x' })).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it('rechaza key con hash válido pero inactiva (401)', async () => {
    // La query filtra .eq('active', true); una key inactiva no hace match → null.
    state.responses = { 'select:api_keys': [{ data: null }] };
    const res = await validateApiKey(`Bearer ${VALID_KEY}`, { endpoint: '/x' });
    expect(res).toMatchObject({ ok: false, status: 401 });
  });

  it('acepta key válida e incrementa el contador de llamadas', async () => {
    state.responses = {
      'select:api_keys': [keyRow],
      'rpc:check_and_log_api_usage': [{ data: { allowed: true, request_count: 1 }, error: null }],
      'update:api_keys': [{ data: null }],
      'rpc:increment_api_key_calls': [{ data: null }],
    };
    const res = await validateApiKey(`Bearer ${VALID_KEY}`, { endpoint: '/x', ip: '1.2.3.4' });
    expect(res).toMatchObject({ ok: true, key: { id: 'k1', user_id: 'u1' } });
    // Se registró el uso (rate limit atómico) y el incremento del contador.
    expect(state.calls).toContain('rpc:check_and_log_api_usage');
    expect(state.calls).toContain('rpc:increment_api_key_calls');
  });

  it('devuelve 429 si se excede el rate limit', async () => {
    state.responses = {
      'select:api_keys': [keyRow],
      'rpc:check_and_log_api_usage': [{ data: { allowed: false, request_count: 101 }, error: null }],
    };
    const res = await validateApiKey(`Bearer ${VALID_KEY}`, { endpoint: '/x' });
    expect(res).toMatchObject({ ok: false, status: 429 });
  });

  it('bajo concurrencia, solo una de dos llamadas pasa el límite (race)', async () => {
    // Cola compartida: la función SQL atómica deja pasar la primera y rechaza la
    // segunda. Simulamos ese resultado serializado con una cola común.
    state.responses = {
      'select:api_keys': [keyRow, keyRow],
      'rpc:check_and_log_api_usage': [
        { data: { allowed: true, request_count: 1 }, error: null },
        { data: { allowed: false, request_count: 2 }, error: null },
      ],
      'update:api_keys': [{ data: null }],
      'rpc:increment_api_key_calls': [{ data: null }],
    };
    const [a, b] = await Promise.all([
      validateApiKey(`Bearer ${VALID_KEY}`, { endpoint: '/x' }),
      validateApiKey(`Bearer ${VALID_KEY}`, { endpoint: '/x' }),
    ]);
    const oks = [a, b].filter((r) => r.ok).length;
    const rejected = [a, b].filter((r) => !r.ok && (r as { status: number }).status === 429).length;
    expect(oks).toBe(1);
    expect(rejected).toBe(1);
  });

  it('hashApiKey es estable (sanity para el lookup por key_hash)', () => {
    expect(hashApiKey(VALID_KEY)).toBe(hashApiKey(VALID_KEY));
  });
});
