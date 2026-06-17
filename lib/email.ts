/**
 * Envío de email transaccional vía Resend.
 *
 * Usamos la API REST de Resend con `fetch` en lugar del SDK `resend` para no
 * añadir una dependencia: la superficie que necesitamos (un POST a /emails) es
 * trivial y así mantenemos el bundle ligero (regla "no dependencias innecesarias").
 *
 * Patrón de FALLO ABIERTO intencional: el email es una notificación best-effort,
 * NO parte del flujo crítico de pago. Si RESEND_API_KEY no está configurado o el
 * envío falla, lo registramos y seguimos — nunca rompemos una confirmación de
 * transacción ni una revocación de key por un email caído.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface EmailNotifications {
  new_subscriber: boolean;
  new_purchase: boolean;
  key_revoked: boolean;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY no configurado; email no enviado');
    return { sent: false, reason: 'no_api_key' };
  }
  const from = process.env.EMAIL_FROM || 'Contenline <noreply@contenline.app>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.warn(`Resend respondió ${res.status}; email no enviado`);
      return { sent: false, reason: `status_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.warn('Fallo al enviar email:', e instanceof Error ? e.message : e);
    return { sent: false, reason: 'fetch_error' };
  }
}

/**
 * Notifica a un creador un evento, respetando sus preferencias. Best-effort:
 * lee las prefs con el admin client (lo pasa el llamador), comprueba que el email
 * esté verificado y el tipo activado, y envía. No lanza.
 */
export async function notifyCreator(
  admin: SupabaseClient,
  creatorId: string,
  type: keyof EmailNotifications,
  email: { subject: string; html: string },
): Promise<void> {
  try {
    const { data } = await admin
      .from('user_email_prefs')
      .select('email, email_verified, email_notifications')
      .eq('user_id', creatorId)
      .maybeSingle();

    const prefs = data as
      | { email: string | null; email_verified: boolean; email_notifications: EmailNotifications }
      | null;
    if (!prefs?.email || !prefs.email_verified) return;
    if (prefs.email_notifications?.[type] === false) return;

    await sendEmail({ to: prefs.email, subject: email.subject, html: email.html });
  } catch (e) {
    console.warn('notifyCreator falló (ignorado):', e instanceof Error ? e.message : e);
  }
}
