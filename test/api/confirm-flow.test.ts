import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeAdmin, MockResponses } from '../helpers/mockSupabase';

// Estado controlado por test: recibo onchain, eventos decodificados y respuestas DB.
const state = vi.hoisted(() => ({
  receipt: null as unknown,
  paymentLogs: [] as Array<{ args: unknown }>,
  subLogs: [] as Array<{ args: unknown }>,
  responses: {} as MockResponses,
  calls: [] as string[],
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeAdmin(state.responses, state.calls),
}));

// Aislamos el rate limit (probado aparte): aquí siempre permite.
vi.mock('@/lib/rateLimit', () => ({
  checkIpRateLimit: async () => ({ allowed: true, count: 1 }),
  clientIp: () => '1.2.3.4',
}));

// Mock parcial de viem: RPC y decodificación de eventos controlados; el resto real.
vi.mock('viem', async (orig) => {
  const actual = await orig<typeof import('viem')>();
  return {
    ...actual,
    http: () => ({}),
    createPublicClient: () => ({
      getTransactionReceipt: async () => {
        if (!state.receipt) throw new Error('not found');
        return state.receipt;
      },
    }),
    parseEventLogs: ({ abi }: { abi: ReadonlyArray<{ name: string }> }) =>
      abi[0].name === 'PaymentCompleted' ? state.paymentLogs : state.subLogs,
  };
});

import { POST } from '@/app/api/transactions/confirm/route';

const PAY = '0x0000000000000000000000000000000000000002'; // whitelisteado (env de test)
const TX = '0x' + 'a'.repeat(64);
const UUID = '550e8400-e29b-41d4-a716-446655440000';

function req(txHash: string) {
  return {
    headers: { get: () => null },
    json: async () => ({ txHash }),
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  state.receipt = null;
  state.paymentLogs = [];
  state.subLogs = [];
  state.responses = {};
  state.calls = [];
});

describe('POST /api/transactions/confirm', () => {
  it('happy path: PaymentCompleted válido → 200 + inserta la transacción', async () => {
    state.receipt = { status: 'success', to: PAY, logs: [{ address: PAY }] };
    state.paymentLogs = [
      { args: { from: '0xfromfromfromfromfromfromfromfromfromfrom', to: PAY, sessionId: UUID, amount: 50_000_000n, fee: 1_500_000n, category: 2 } },
    ];
    state.responses = {
      'select:transactions': [{ data: null }], // idempotencia: no existe
      'select:payment_sessions': [{ data: { id: UUID, amount_usdc: 50, creator_id: 'c1', api_key_id: 'k1' } }],
      'insert:transactions': [{ data: { id: 't1', verified: true } }],
      'update:payment_sessions': [{ data: null }],
    };
    const res = await POST(req(TX));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.verified).toBe(true);
    expect(state.calls).toContain('insert:transactions');
  });

  it('monto onchain ≠ payment_session → 400', async () => {
    state.receipt = { status: 'success', to: PAY, logs: [{ address: PAY }] };
    state.paymentLogs = [
      { args: { from: '0xabc', to: PAY, sessionId: UUID, amount: 40_000_000n, fee: 0n, category: 2 } },
    ];
    state.responses = {
      'select:transactions': [{ data: null }],
      'select:payment_sessions': [{ data: { id: UUID, amount_usdc: 50, creator_id: 'c1', api_key_id: null } }],
    };
    const res = await POST(req(TX));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no coincide/i);
  });

  it('receipt revertido → 400', async () => {
    state.receipt = { status: 'reverted', to: PAY, logs: [] };
    state.responses = { 'select:transactions': [{ data: null }] };
    const res = await POST(req(TX));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no fue exitosa/i);
  });

  it('txHash duplicado → 409', async () => {
    state.responses = { 'select:transactions': [{ data: { id: 't0' } }] };
    const res = await POST(req(TX));
    expect(res.status).toBe(409);
  });

  it('evento emitido por contrato no whitelisteado → 400', async () => {
    state.receipt = { status: 'success', to: '0x9999999999999999999999999999999999999999', logs: [] };
    state.responses = { 'select:transactions': [{ data: null }] };
    const res = await POST(req(TX));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no autorizado/i);
  });

  it('txHash con formato inválido → 400', async () => {
    const res = await POST(req('0xnothex'));
    expect(res.status).toBe(400);
  });
});
