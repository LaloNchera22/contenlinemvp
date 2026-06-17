import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeAdmin, MockResponses } from '../helpers/mockSupabase';

// Sesión y cliente server (RLS) mockeados: probamos la lógica de las rutas CRUD
// del creador (validación + forma de la respuesta), no la capa de Supabase.
const state = vi.hoisted(() => ({
  responses: {} as MockResponses,
  calls: [] as string[],
  session: { sub: 'u1', wallet: '0xabc', token: 't', role: 'authenticated' } as unknown,
}));

vi.mock('@/lib/auth', () => ({
  // Devuelve la sesión configurable; null simula no autenticado.
  getSessionFromRequest: () => state.session,
}));
vi.mock('@/lib/supabase/server', () => ({
  SESSION_COOKIE: 'contenline-session',
  createServerClient: () => makeAdmin(state.responses, state.calls),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeAdmin(state.responses, state.calls),
}));

import { POST as plansPost, GET as plansGet } from '@/app/api/plans/route';
import { PUT as planPut, DELETE as planDelete } from '@/app/api/plans/[id]/route';
import { POST as coursesPost } from '@/app/api/courses/route';
import { DELETE as courseDelete } from '@/app/api/courses/[id]/route';
import { PUT as coursePublish } from '@/app/api/courses/[id]/publish/route';
import { POST as servicesPost } from '@/app/api/services/route';
import { PUT as servicePut } from '@/app/api/services/[id]/route';
import { POST as contentPost } from '@/app/api/content/route';
import { GET as keysGet, POST as keysPost } from '@/app/api/keys/route';
import { DELETE as keyDelete } from '@/app/api/keys/[id]/route';
import { GET as meGet, DELETE as meDelete } from '@/app/api/me/route';
import { GET as metricsGet } from '@/app/api/metrics/route';
import { GET as txGet } from '@/app/api/transactions/route';
import { GET as exportGet } from '@/app/api/transactions/export/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';

function req(body: unknown, url = 'http://localhost/api') {
  return { headers: { get: () => null }, json: async () => body, url } as never;
}
const params = (id: string) => ({ params: { id } });

beforeEach(() => {
  state.responses = {};
  state.calls = [];
  state.session = { sub: 'u1', wallet: '0xabc', token: 't', role: 'authenticated' };
});

describe('auth guard (sin sesión → 401)', () => {
  it('todas las rutas del creador exigen sesión', async () => {
    state.session = null;
    const guarded: Array<Promise<{ status: number }>> = [
      plansGet(req(null)),
      plansPost(req({ name: 'x', price_usdc: 1, interval: 'monthly' })),
      planPut(req({ name: 'x', price_usdc: 1, interval: 'monthly' }), params('p1')),
      planDelete(req(null), params('p1')),
      coursesPost(req({ title: 'xxx', price_usdc: 1 })),
      courseDelete(req(null), params('c1')),
      coursePublish(req({ published: true }), params('c1')),
      servicesPost(req({ title: 'xxx', price_usdc: 1 })),
      servicePut(req({ title: 'xxx', price_usdc: 1 }), params('s1')),
      contentPost(req({ title: 'x' })),
      keysGet(req(null)),
      keysPost(req({ name: 'x' })),
      keyDelete(req(null), params('k1')),
      meGet(req(null)),
      meDelete(req(null)),
      metricsGet(req(null)),
      txGet(req(null)),
    ];
    const results = await Promise.all(guarded);
    expect(results.every((r) => r.status === 401)).toBe(true);
  });
});

describe('plans CRUD', () => {
  it('POST valida nombre corto (400)', async () => {
    const res = await plansPost(req({ name: 'ab', price_usdc: 5, interval: 'monthly' }));
    expect(res.status).toBe(400);
  });

  it('POST valida interval (400)', async () => {
    const res = await plansPost(req({ name: 'Plan VIP', price_usdc: 5, interval: 'weekly' }));
    expect(res.status).toBe(400);
  });

  it('POST valida precio (400)', async () => {
    const res = await plansPost(req({ name: 'Plan VIP', price_usdc: 0, interval: 'monthly' }));
    expect(res.status).toBe(400);
  });

  it('POST crea el plan y devuelve onchain_plan_id (201)', async () => {
    state.responses = {
      'insert:subscription_plans': [{ data: { id: 'p1', onchain_plan_id: 7, onchain_synced: false } }],
    };
    const res = await plansPost(req({ name: 'Plan VIP', price_usdc: 9.99, interval: 'monthly' }));
    expect(res.status).toBe(201);
    expect((await res.json()).plan.onchain_plan_id).toBe(7);
  });

  it('GET lista los planes del creador', async () => {
    state.responses = { 'select:subscription_plans': [{ data: [{ id: 'p1' }] }] };
    const res = await plansGet(req(null));
    expect(res.status).toBe(200);
    expect((await res.json()).plans).toHaveLength(1);
  });

  it('PUT re-marca onchain_synced=false', async () => {
    state.responses = { 'update:subscription_plans': [{ data: { id: 'p1', onchain_synced: false } }] };
    const res = await planPut(req({ name: 'Plan Pro', price_usdc: 20, interval: 'yearly' }), params('p1'));
    expect(res.status).toBe(200);
  });

  it('DELETE devuelve datos para el setPlan(active=false) onchain', async () => {
    state.responses = {
      'update:subscription_plans': [{ data: { id: 'p1', onchain_plan_id: 7, price_usdc: 9.99, interval: 'monthly' } }],
    };
    const res = await planDelete(req(null), params('p1'));
    expect(res.status).toBe(200);
    expect((await res.json()).plan.onchain_plan_id).toBe(7);
  });

  it('PUT a plan inexistente → 404', async () => {
    state.responses = { 'update:subscription_plans': [{ data: null }] };
    const res = await planPut(req({ name: 'Plan Pro', price_usdc: 20, interval: 'yearly' }), params('nope'));
    expect(res.status).toBe(404);
  });
});

describe('courses CRUD', () => {
  it('POST valida título (400)', async () => {
    const res = await coursesPost(req({ title: 'ab', price_usdc: 10 }));
    expect(res.status).toBe(400);
  });

  it('POST crea curso (201)', async () => {
    state.responses = { 'insert:courses': [{ data: { id: 'c1', published: false } }] };
    const res = await coursesPost(req({ title: 'Curso Solidity', price_usdc: 49 }));
    expect(res.status).toBe(201);
  });

  it('publish exige booleano (400)', async () => {
    const res = await coursePublish(req({ published: 'yes' }), params('c1'));
    expect(res.status).toBe(400);
  });

  it('publish alterna el estado (200)', async () => {
    state.responses = { 'update:courses': [{ data: { id: 'c1', published: true } }] };
    const res = await coursePublish(req({ published: true }), params('c1'));
    expect(res.status).toBe(200);
  });

  it('DELETE elimina (200)', async () => {
    state.responses = { 'delete:courses': [{ data: null, error: null }] };
    const res = await courseDelete(req(null), params('c1'));
    expect(res.status).toBe(200);
  });
});

describe('services CRUD', () => {
  it('POST crea servicio (201)', async () => {
    state.responses = { 'insert:services': [{ data: { id: 's1', active: true } }] };
    const res = await servicesPost(req({ title: 'Consultoría 1h', price_usdc: 100 }));
    expect(res.status).toBe(201);
  });

  it('PUT actualiza servicio (200)', async () => {
    state.responses = { 'update:services': [{ data: { id: 's1', active: false } }] };
    const res = await servicePut(req({ title: 'Consultoría 2h', price_usdc: 150, active: false }), params('s1'));
    expect(res.status).toBe(200);
  });
});

describe('content', () => {
  it('POST valida título requerido (400)', async () => {
    const res = await contentPost(req({ title: '' }));
    expect(res.status).toBe(400);
  });

  it('POST crea contenido (201)', async () => {
    state.responses = { 'insert:content': [{ data: { id: 'co1' } }] };
    const res = await contentPost(req({ title: 'Mi post', body: 'hola', is_exclusive: false }));
    expect(res.status).toBe(201);
  });
});

describe('keys', () => {
  it('GET lista keys', async () => {
    state.responses = { 'select:api_keys': [{ data: [{ id: 'k1', name: 'x' }] }] };
    const res = await keysGet(req(null));
    expect(res.status).toBe(200);
  });

  it('POST exige name (400)', async () => {
    const res = await keysPost(req({ environment: 'test' }));
    expect(res.status).toBe(400);
  });

  it('POST crea key y devuelve el secreto una vez (201)', async () => {
    state.responses = { 'insert:api_keys': [{ data: { id: 'k1', name: 'Mi key', environment: 'test' } }] };
    const res = await keysPost(req({ name: 'Mi key', environment: 'test' }));
    expect(res.status).toBe(201);
    expect((await res.json()).secret).toMatch(/^sk_test_/);
  });

  it('DELETE revoca la key (200)', async () => {
    state.responses = { 'update:api_keys': [{ data: null, error: null }] };
    const res = await keyDelete(req(null), params('k1'));
    expect(res.status).toBe(200);
  });
});

describe('me', () => {
  it('GET devuelve el perfil', async () => {
    state.responses = { 'select:users': [{ data: { id: 'u1', wallet: '0xabc', username: 'lalo' } }] };
    const res = await meGet(req(null));
    expect(res.status).toBe(200);
  });

  it('DELETE anonimiza el perfil (derecho al olvido)', async () => {
    state.responses = {
      'update:users': [{ data: null, error: null }],
      'update:api_keys': [{ data: null, error: null }],
    };
    const res = await meDelete(req(null));
    expect(res.status).toBe(200);
    expect((await res.json()).anonymized).toBe(true);
  });
});

describe('metrics & transactions', () => {
  it('metrics agrega ingresos del mes (200)', async () => {
    state.responses = {
      'select:transactions': [
        { data: [{ category: 'onchain', amount_usdc: 100, fee_usdc: 3, net_usdc: 97 }] },
      ],
      'select:subscriptions': [{ count: 2, data: null }],
    };
    const res = await metricsGet(req(null));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.grossRevenue).toBe(100);
    expect(json.netRevenue).toBe(97);
  });

  it('transactions lista paginada con filtro (200)', async () => {
    state.responses = { 'select:transactions': [{ data: [{ id: 't1' }], count: 1 }] };
    const res = await txGet(req(null, 'http://localhost/api/transactions?category=onchain&page=1'));
    expect(res.status).toBe(200);
    expect((await res.json()).transactions).toHaveLength(1);
  });

  it('export genera CSV con cabecera y escape de celdas', async () => {
    state.responses = {
      'select:transactions': [
        {
          data: [
            { created_at: '2025-01-01', category: 'onchain', from_wallet: '0xabc', amount_usdc: 100, fee_percent: 3, fee_usdc: 3, net_usdc: 97, tx_hash: '0xhash', verified: true },
            { created_at: '2025-01-02', category: 'course', from_wallet: '0xdef', amount_usdc: 50, fee_percent: 10, fee_usdc: 5, net_usdc: 45, tx_hash: null, verified: false },
          ],
        },
      ],
    };
    const res = await exportGet(req(null, 'http://localhost/api/transactions/export?category=onchain'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    const text = await res.text();
    expect(text).toContain('fecha,categoria');
    expect(text.split('\r\n')).toHaveLength(3); // cabecera + 2 filas
  });
});

describe('logout', () => {
  it('borra la cookie de sesión (200)', async () => {
    const res = await logoutPost();
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
