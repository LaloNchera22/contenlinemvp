'use client';

import { useState } from 'react';

/**
 * CTA de la página de confianza. IMPORTANTE: NO procesa ningún pago.
 *
 * El botón solo marca la INTENCIÓN del cliente (PATCH status→accepted) y revela
 * las instrucciones para coordinar el pago MANUALMENTE (transferencia/SPEI).
 * No hay Stripe, ni cobros, ni flujo on-chain de USDC aquí — es una capa de
 * confianza, no de dinero, a propósito, por razones regulatorias.
 *
 * TODO (pendiente, fuera de alcance): conectar aquí el escrow real (custodia +
 * liberación al aprobar) cuando exista el marco regulatorio para hacerlo.
 */
export default function CommissionClient({
  commissionId,
  initialAccepted,
  artistName,
  supportEmail,
}: {
  commissionId: string;
  initialAccepted: boolean;
  artistName: string;
  supportEmail: string;
}) {
  const [accepted, setAccepted] = useState(initialAccepted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/comision/${commissionId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No pudimos registrar tu confirmación. Intenta de nuevo.');
        return;
      }
      setAccepted(true);
    } catch {
      setError('Hubo un problema de conexión. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  if (accepted) {
    return (
      <section className="card border-brand/30" aria-live="polite">
        <p className="text-sm font-semibold text-ink">Confirmaste el trato ✓</p>
        <p className="mt-1 text-sm text-ink/70">
          Ahora coordina el pago con {artistName}. Recuerda: tu dinero queda
          protegido y el artista no cobra hasta que apruebes la entrega.
        </p>

        <div className="mt-4 rounded-lg bg-surface p-4 text-sm text-ink/80">
          <p className="font-medium text-ink">Cómo coordinar el pago</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Escribe a {artistName} o a nuestro equipo para recibir los datos.</li>
            <li>Realiza la transferencia / SPEI al monto acordado.</li>
            <li>Guarda tu comprobante: te servirá al momento de aprobar la entrega.</li>
          </ol>
          <p className="mt-3 text-xs text-ink/60">
            ¿Necesitas ayuda?{' '}
            <a href={`mailto:${supportEmail}`} className="font-medium underline">
              {supportEmail}
            </a>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <button onClick={accept} disabled={busy} className="btn-primary w-full py-3 text-base">
        {busy ? 'Confirmando…' : 'Aceptar y coordinar pago'}
      </button>
      {error && (
        <p className="mt-2 text-xs text-amber-600" role="status" aria-live="polite">
          {error}
        </p>
      )}
      <p className="mt-2 text-center text-[11px] text-ink/50">
        Al aceptar confirmas el trato. No se te cobra nada en este paso.
      </p>
    </section>
  );
}
