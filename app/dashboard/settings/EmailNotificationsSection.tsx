'use client';

import { useEffect, useState } from 'react';

interface Notifications {
  new_subscriber: boolean;
  new_purchase: boolean;
  key_revoked: boolean;
}

const TOGGLES: { key: keyof Notifications; label: string }[] = [
  { key: 'new_subscriber', label: 'Nuevo suscriptor' },
  { key: 'new_purchase', label: 'Nueva venta' },
  { key: 'key_revoked', label: 'API key revocada' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mensajes del redirect de /api/email/verify (?email=...).
const VERIFY_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  verified: { text: 'Email verificado. Ya recibirás notificaciones.', ok: true },
  expired: { text: 'El enlace de verificación caducó. Solicita uno nuevo.', ok: false },
  invalid: { text: 'Enlace de verificación inválido.', ok: false },
  error: { text: 'No se pudo verificar el email. Intenta de nuevo.', ok: false },
};

/**
 * Sección de notificaciones por email. Gestiona el flujo de verificación (magic
 * link) y los toggles por tipo de evento. El email se guarda en una tabla aparte
 * (user_email_prefs) con RLS owner-only, por lo que estos datos solo los ve el dueño.
 */
export default function EmailNotificationsSection() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [verified, setVerified] = useState(false);
  const [notifications, setNotifications] = useState<Notifications>({
    new_subscriber: true,
    new_purchase: true,
    key_revoked: true,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setEmail(d.email ?? '');
          setVerified(!!d.email_verified);
          if (d.email_notifications) setNotifications(d.email_notifications);
        }
      })
      .finally(() => setLoading(false));

    // Mostrar el resultado de un magic link recién abierto (?email=verified|...).
    const param = new URLSearchParams(window.location.search).get('email');
    if (param && VERIFY_MESSAGES[param]) {
      setStatus(VERIFY_MESSAGES[param].text);
      setStatusOk(VERIFY_MESSAGES[param].ok);
    }
  }, []);

  async function requestVerification() {
    setStatus(null);
    if (!EMAIL_RE.test(email.trim())) {
      setStatus('Introduce un email válido.');
      setStatusOk(false);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/email/request-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus(d.error || 'No se pudo enviar la verificación.');
        setStatusOk(false);
      } else if (d.emailSent === false) {
        setStatus('Verificación generada, pero el envío de email no está configurado en este entorno.');
        setStatusOk(false);
      } else {
        setStatus('Te enviamos un enlace de verificación. Revisa tu bandeja.');
        setStatusOk(true);
      }
    } catch {
      setStatus('Error de red al solicitar la verificación.');
      setStatusOk(false);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(key: keyof Notifications) {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next); // optimista
    const r = await fetch('/api/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_notifications: next }),
    });
    if (!r.ok) {
      setNotifications(notifications); // revertir
      setStatus('No se pudo guardar la preferencia.');
      setStatusOk(false);
    }
  }

  return (
    <div className="card mt-6">
      <h2 className="font-semibold">Notificaciones por email</h2>
      <p className="text-sm text-white/60 mt-1">
        Recibe un aviso cuando ocurra algo importante en tu cuenta. Tu email es
        privado y solo se usa para estas notificaciones.
      </p>

      {loading ? (
        <p className="text-sm text-white/60 mt-3">Cargando…</p>
      ) : (
        <>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <label className="label" htmlFor="email-input">Email</label>
              <input
                id="email-input"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                disabled={busy}
              />
            </div>
            <button onClick={requestVerification} disabled={busy} className="btn-ghost">
              {busy ? 'Enviando…' : verified ? 'Cambiar email' : 'Verificar'}
            </button>
          </div>

          {verified ? (
            <p className="text-xs text-green-400 mt-2">✓ Email verificado</p>
          ) : (
            <p className="text-xs text-amber-400 mt-2">
              Email sin verificar. No recibirás notificaciones hasta confirmarlo.
            </p>
          )}

          {status && (
            <p className={`text-sm mt-3 ${statusOk ? 'text-green-400' : 'text-amber-400'}`} role="status">
              {status}
            </p>
          )}

          {verified && (
            <div className="mt-5 space-y-2">
              {TOGGLES.map((t) => (
                <label key={t.key} className="flex items-center justify-between gap-3 text-sm">
                  <span>{t.label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={notifications[t.key]}
                    onChange={() => toggle(t.key)}
                  />
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
