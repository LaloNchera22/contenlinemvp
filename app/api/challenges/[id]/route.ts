import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { actOnChallenge, LedgerError, type ChallengeAction } from '@/lib/challenges';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS: ChallengeAction[] = ['accept', 'fulfill', 'decline', 'cancel'];

/**
 * PATCH /api/challenges/[id]
 * body: { action: 'accept' | 'fulfill' | 'decline' | 'cancel' }
 *
 * The Postgres function enforces who may run each action (creator vs. fan) and
 * which status transitions are legal, and moves the escrowed stake atomically:
 * fulfill pays the creator (net of fee); decline/cancel refunds the fan.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  if (!UUID.test(params.id)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.action || !ACTIONS.includes(body.action as ChallengeAction)) {
    return NextResponse.json({ error: "action debe ser accept/fulfill/decline/cancel" }, { status: 400 });
  }

  try {
    const status = await actOnChallenge(params.id, session.sub, body.action as ChallengeAction);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    if (e instanceof LedgerError) {
      const map: Record<string, [string, number]> = {
        challenge_not_found: ['Reto no encontrado', 404],
        forbidden: ['No autorizado para esta acción', 403],
        invalid_transition: ['La acción no es válida para el estado actual del reto', 409],
        unknown_action: ['Acción desconocida', 400],
      };
      const [msg, code] = map[e.code] ?? ['No se pudo procesar la acción', 500];
      return NextResponse.json({ error: msg }, { status: code });
    }
    return NextResponse.json({ error: 'No se pudo procesar la acción' }, { status: 500 });
  }
}
