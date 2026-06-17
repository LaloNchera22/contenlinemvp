import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { LIMITS, requireString, optionalString, validatePrice, isValidationError } from '@/lib/validation';

export const runtime = 'nodejs';

const INTERVALS = ['monthly', 'yearly'];

/**
 * PUT /api/plans/[id] — actualiza precio/duración/descripción.
 *
 * Cambiar precio o intervalo requiere TAMBIÉN una llamada setPlan() onchain (el
 * contrato es la fuente de verdad del monto que se cobra). Por eso volvemos a
 * marcar onchain_synced=false: la UI debe disparar setPlan() y la Edge Function
 * lo re-sincroniza al ver el nuevo evento PlanSet.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: { name?: string; price_usdc?: number; interval?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const name = requireString(body.name, 'name', 3, LIMITS.plan_name);
  if (isValidationError(name)) return NextResponse.json(name, { status: 400 });

  const price = validatePrice(body.price_usdc);
  if (isValidationError(price)) return NextResponse.json(price, { status: 400 });

  if (!body.interval || !INTERVALS.includes(body.interval)) {
    return NextResponse.json({ error: "interval debe ser 'monthly' o 'yearly'" }, { status: 400 });
  }

  const description = optionalString(body.description, 'description', LIMITS.plan_description);
  if (isValidationError(description)) return NextResponse.json(description, { status: 400 });

  const supabase = createServerClient(session.token);
  // RLS (creator_manage_plans) garantiza que solo afecta planes propios.
  const { data, error } = await supabase
    .from('subscription_plans')
    .update({
      name,
      price_usdc: price,
      interval: body.interval,
      description,
      onchain_synced: false,
    })
    .eq('id', params.id)
    .eq('creator_id', session.sub)
    .select('id, name, price_usdc, interval, description, active, onchain_plan_id, onchain_synced')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'No se pudo actualizar el plan' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
  return NextResponse.json({ plan: data });
}

/**
 * DELETE /api/plans/[id] — desactiva el plan (soft delete).
 *
 * No borramos la fila: el onchain_plan_id está referenciado en transacciones y
 * suscripciones históricas. Marcamos active=false; el cliente DEBE además llamar
 * setPlan(id, price, duration, false) onchain para que el contrato deje de
 * aceptar suscripciones a este plan.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const supabase = createServerClient(session.token);
  const { data, error } = await supabase
    .from('subscription_plans')
    .update({ active: false, onchain_synced: false })
    .eq('id', params.id)
    .eq('creator_id', session.sub)
    .select('id, onchain_plan_id, price_usdc, interval')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'No se pudo desactivar el plan' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
  // Devolvemos los datos que el cliente necesita para el setPlan(active=false) onchain.
  return NextResponse.json({ ok: true, plan: data });
}
