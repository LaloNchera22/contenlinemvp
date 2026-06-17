import { vi } from 'vitest';

/**
 * Mock minimalista del admin client de Supabase para tests unitarios.
 *
 * Modela el query builder encadenable (from().select().eq()...maybeSingle()) y
 * .rpc(). Las respuestas se encolan por clave `${op}:${table}` o `rpc:${name}`;
 * cada llamada terminal consume (shift) el siguiente valor de su cola. Las colas
 * se MUTAN compartidas entre instancias creadas con el mismo objeto `responses`,
 * de modo que llamadas concurrentes que comparten ese objeto compiten por los
 * mismos resultados (útil para simular carreras).
 */
export type MockResponses = Record<string, Array<{ data?: unknown; error?: unknown; allowed?: boolean; request_count?: number }>>;

export function makeAdmin(responses: MockResponses, calls: string[] = []) {
  function next(key: string) {
    const q = responses[key];
    if (q && q.length) return q.shift();
    return { data: null, error: null };
  }

  function builder(table: string) {
    let op = 'select';
    const b: Record<string, unknown> = {};
    const chain = () => b;
    Object.assign(b, {
      select: chain,
      insert: () => ((op = 'insert'), b),
      update: () => ((op = 'update'), b),
      delete: () => ((op = 'delete'), b),
      eq: chain,
      ilike: chain,
      gt: chain,
      gte: chain,
      lt: chain,
      order: chain,
      range: chain,
      limit: chain,
      maybeSingle: () => {
        calls.push(`${op}:${table}`);
        return Promise.resolve(next(`${op}:${table}`));
      },
      single: () => {
        calls.push(`${op}:${table}`);
        return Promise.resolve(next(`${op}:${table}`));
      },
      // Awaitable directo (update/delete sin select).
      then: (resolve: (v: unknown) => void) => {
        calls.push(`${op}:${table}`);
        resolve(next(`${op}:${table}`));
      },
    });
    return b;
  }

  return {
    from: (table: string) => builder(table),
    rpc: (name: string) => {
      calls.push(`rpc:${name}`);
      const result = next(`rpc:${name}`);
      return {
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (v: unknown) => void) => resolve(result),
      };
    },
    storage: {
      from: () => ({
        upload: vi.fn(async () => ({ data: {}, error: null })),
        createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'https://x/y' }, error: null })),
        getPublicUrl: () => ({ data: { publicUrl: 'https://x/y' } }),
      }),
    },
  };
}
