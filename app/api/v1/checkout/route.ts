import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/validateApiKey';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSafeWebhookUrl } from '@/lib/webhook';

export const runtime = 'nodejs';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

// Categorías permitidas para el checkout externo. NO incluye 'subscription':
// las suscripciones (fee 10%) se crean por su propio flujo, no por esta API.
// Sin esta lista un developer podría forzar una categoría con fee distinto.
const ALLOWED_CATEGORIES = ['onchain', 'course', 'service'] as const;
type CheckoutCategory = (typeof ALLOWED_CATEGORIES)[number];

/**
 * POST /api/v1/checkout  (API pública — requiere Bearer sk_prod_xxx / sk_test_xxx)
 * Crea una payment session embebible que el comprador completará onchain.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const auth = await validateApiKey(req.headers.get('authorization'), {
    endpoint: '/api/v1/checkout',
    ip,
  });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: {
    amount_usdc?: number;
    category?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    webhook_url?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const amount = Number(body.amount_usdc);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount_usdc inválido' }, { status: 400 });
  }
  const category = (body.category ?? 'onchain') as CheckoutCategory;
  if (!ALLOWED_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `category inválida; permitidas: ${ALLOWED_CATEGORIES.join(', ')}` },
      { status: 400 },
    );
  }

  // metadata es opcional y se devuelve íntegra en el webhook. Sin un tope, un
  // developer podría enviar megabytes ({"a": "x".repeat(10_000_000)}) y forzar
  // consumo excesivo de memoria al parsear/serializar y al notificar. 4KB es un
  // límite razonable para metadata de negocio.
  if (body.metadata !== undefined) {
    if (typeof body.metadata !== 'object' || body.metadata === null || Array.isArray(body.metadata)) {
      return NextResponse.json({ error: 'metadata debe ser un objeto' }, { status: 400 });
    }
    if (JSON.stringify(body.metadata).length > 4096) {
      return NextResponse.json({ error: 'metadata excede el límite de 4096 bytes' }, { status: 400 });
    }
  }

  // webhook_url es opcional, pero si se envía el servidor le hará fetch luego:
  // exigimos https hacia un host público para evitar SSRF.
  if (body.webhook_url !== undefined && !isSafeWebhookUrl(body.webhook_url)) {
    return NextResponse.json(
      { error: 'webhook_url inválida: debe ser https hacia un host público' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // El creador es el dueño de la API key.
  const { data: keyRow } = await admin
    .from('api_keys')
    .select('user_id')
    .eq('id', auth.key.id)
    .single();

  // Sin user_id no podemos atribuir la sesión a un creador; fallar antes de
  // insertar una fila con creator_id null que rompería las políticas RLS.
  if (!keyRow?.user_id) {
    return NextResponse.json({ error: 'API key sin usuario asociado' }, { status: 500 });
  }

  const { data: session, error } = await admin
    .from('payment_sessions')
    .insert({
      api_key_id: auth.key.id,
      creator_id: keyRow.user_id,
      amount_usdc: amount,
      category,
      description: body.description ?? null,
      metadata: body.metadata ?? null,
      webhook_url: body.webhook_url ?? null,
      status: 'pending',
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    })
    .select('id, amount_usdc, category, status, expires_at, created_at')
    .single();

  if (error || !session) {
    return NextResponse.json({ error: 'No se pudo crear la sesión' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return NextResponse.json(
    {
      session,
      checkout_url: `${appUrl}/checkout/${session.id}`,
    },
    { status: 201 },
  );
}
