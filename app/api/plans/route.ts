import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { LIMITS, requireString, optionalString, validatePrice, isValidationError } from '@/lib/validation';

export const runtime = 'nodejs';

const INTERVALS = ['monthly', 'yearly'];

/** GET /api/plans — planes del creador autenticado (incluye inactivos). */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const supabase = createServerClient(session.token);
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id, name, price_usdc, interval, description, active, onchain_plan_id, onchain_synced, created_at')
    .eq('creator_id', session.sub)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Error al consultar' }, { status: 500 });
  return NextResponse.json({ plans: data ?? [] });
}

/**
 * POST /api/plans — crea el plan en DB y devuelve onchain_plan_id.
 *
 * La fila se crea ANTES de la tx onchain a propósito: Postgres asigna el
 * onchain_plan_id (IDENTITY) que el cliente necesita para llamar a setPlan() en
 * el contrato. Hasta que la Edge Function observe el evento PlanSet, onchain_synced
 * queda en false y el plan no acepta suscripciones reales.
 */
export async function POST(req: NextRequest) {
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
  const { data, error } = await supabase
    .from('subscription_plans')
    .insert({
      creator_id: session.sub,
      name,
      price_usdc: price,
      interval: body.interval,
      description,
      active: true,
      onchain_synced: false,
    })
    .select('id, name, price_usdc, interval, description, active, onchain_plan_id, onchain_synced, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo crear el plan' }, { status: 500 });
  }
  // onchain_plan_id es el entero que el cliente pasa a setPlan() onchain.
  return NextResponse.json({ plan: data }, { status: 201 });
}
