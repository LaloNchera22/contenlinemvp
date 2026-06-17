import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { getSessionFromRequest } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkIpRateLimit, clientIp } from '@/lib/rateLimit';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

// Validación de email simple pero suficiente: un único @, sin espacios, con punto
// en el dominio. La verificación real es el magic link (no confiamos en el formato).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 min

/**
 * POST /api/email/request-verification  body: { email }
 * Genera un token de un solo uso, lo guarda HASHEADO y envía un magic link.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  // Anti-spam: un usuario no debería pedir verificaciones en bucle (cada una
  // dispara un email). 5/hora por IP es holgado.
  const rl = await checkIpRateLimit(clientIp(req), 'email-verify', 5, 3600);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes; intenta más tarde' }, { status: 429 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const email = (body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  const admin = createAdminClient();
  // Invalidar tokens previos del usuario (solo el último magic link debe servir).
  await admin.from('email_verifications').delete().eq('user_id', session.sub);
  const { error } = await admin.from('email_verifications').insert({
    token_hash: tokenHash,
    user_id: session.sub,
    email,
    expires_at: expiresAt,
  });
  if (error) {
    return NextResponse.json({ error: 'No se pudo generar la verificación' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const link = `${appUrl}/api/email/verify?token=${token}`;
  const result = await sendEmail({
    to: email,
    subject: 'Verifica tu email en Contenline',
    html: `
      <p>Hola,</p>
      <p>Confirma este email para activar las notificaciones de tu cuenta de Contenline.</p>
      <p><a href="${link}">Verificar mi email</a></p>
      <p>El enlace caduca en 30 minutos. Si no fuiste tú, ignora este mensaje.</p>
    `,
  });

  // No revelamos si el email existe ni el detalle del proveedor. Si el envío
  // falló por falta de RESEND_API_KEY, devolvemos un aviso explícito para que el
  // creador (en un entorno sin email configurado) entienda por qué no llega.
  return NextResponse.json({ ok: true, emailSent: result.sent });
}
