import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/comision/[id]/accept
 *
 * Marca la INTENCIÓN del cliente de aceptar la comisión. NO procesa ni coordina
 * ningún pago: solo mueve el status de la comisión de `pending` a `accepted`.
 * Es público a propósito (el cliente no tiene cuenta) — por eso solo permite esta
 * única transición y nunca expone datos de la comisión en la respuesta.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!UUID_V4.test(id)) {
    return NextResponse.json({ error: 'Comisión no encontrada' }, { status: 404 });
  }

  const admin = createAdminClient();

  const { data: commission } = await admin
    .from('commissions')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (!commission) {
    return NextResponse.json({ error: 'Comisión no encontrada' }, { status: 404 });
  }
  if (commission.status === 'cancelled') {
    return NextResponse.json({ error: 'Esta comisión fue cancelada' }, { status: 409 });
  }
  if (commission.status === 'accepted') {
    // Idempotente: reconfirmar no es un error.
    return NextResponse.json({ status: 'accepted' });
  }

  const { error } = await admin
    .from('commissions')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');

  if (error) {
    return NextResponse.json({ error: 'No se pudo registrar la confirmación' }, { status: 500 });
  }

  return NextResponse.json({ status: 'accepted' });
}
