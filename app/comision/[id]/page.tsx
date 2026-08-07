import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import CommissionClient from './CommissionClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Contacto real visible como señal de confianza. Configurable por entorno para
// que la marca use su propio correo de soporte sin tocar código.
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'hola@adie.app';

export const metadata: Metadata = {
  title: 'Tu comisión — adie',
  description:
    'Tu dinero se queda seguro y el artista no cobra hasta que tú apruebes la entrega.',
};

async function getCommission(id: string) {
  if (!UUID_V4.test(id)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from('commissions')
    .select('id, artist_id, client_name, work_description, amount, currency, status')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;

  const { data: artist } = await admin
    .from('users')
    .select('display_name, username')
    .eq('id', data.artist_id)
    .maybeSingle();
  if (!artist) return null;

  return { commission: data, artist };
}

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Moneda no reconocida por Intl: cae a un formato simple pero legible.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export default async function CommissionPage({ params }: { params: { id: string } }) {
  const data = await getCommission(params.id);
  if (!data) notFound();
  const { commission, artist } = data;

  const artistName = artist.display_name || `@${artist.username}`;
  const cancelled = commission.status === 'cancelled';

  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md space-y-4">
        {/* Marca — señal de confianza: esto es un servicio, no un proyecto suelto. */}
        <header className="flex items-center gap-2 px-1">
          <Image src="/adie-logo.png" alt="adie" width={28} height={28} priority />
          <span className="text-sm font-semibold text-ink">adie</span>
          <span className="ml-auto text-[11px] uppercase tracking-wide text-ink/50">
            Pago protegido
          </span>
        </header>

        {/* El trato específico: el cliente ve su propio nombre y su trato. */}
        <section className="card">
          <p className="text-xs uppercase tracking-wide text-ink/60">Comisión para</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">{commission.client_name}</h1>
          <p className="mt-1 text-sm text-ink/70">
            Trabajo acordado con <span className="font-medium text-ink">{artistName}</span>
          </p>

          <div className="mt-4 rounded-lg bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-ink/60">Descripción del trabajo</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink">
              {commission.work_description}
            </p>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-sm text-ink/70">Monto acordado</span>
            <span className="text-xl font-bold text-ink">
              {formatAmount(Number(commission.amount), commission.currency)}
            </span>
          </div>
        </section>

        {/* Mensaje central — el escrow desde la perspectiva del CLIENTE. */}
        <section className="card border-brand/30 bg-brand/5">
          <p className="text-lg font-semibold leading-snug text-ink">
            Tu dinero se queda seguro y {artistName} no cobra hasta que{' '}
            <span className="text-brand">tú apruebes la entrega.</span>
          </p>
        </section>

        {/* Cómo funciona — 3 pasos. */}
        <section className="card">
          <p className="text-xs uppercase tracking-wide text-ink/60">Cómo funciona</p>
          <ol className="mt-3 space-y-3">
            {[
              {
                t: 'Depositas',
                d: 'Coordinas el pago y el monto queda resguardado. El artista aún no lo recibe.',
              },
              {
                t: 'El artista entrega',
                d: `${artistName} realiza el trabajo y te lo entrega para revisión.`,
              },
              {
                t: 'Apruebas y se libera',
                d: 'Cuando estás conforme, apruebas y recién entonces se libera el pago.',
              },
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{step.t}</p>
                  <p className="text-sm text-ink/70">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA — NO procesa pago. Solo marca intención + muestra instrucciones. */}
        {cancelled ? (
          <section className="card">
            <p className="text-sm text-amber-600">
              Esta comisión fue cancelada. Si crees que es un error, contáctanos.
            </p>
          </section>
        ) : (
          <CommissionClient
            commissionId={commission.id}
            initialAccepted={commission.status === 'accepted'}
            artistName={artistName}
            supportEmail={SUPPORT_EMAIL}
          />
        )}

        {/* Contacto real — señal de confianza. */}
        <footer className="px-1 pb-2 text-center text-[11px] leading-relaxed text-ink/50">
          <p>
            adie · ¿Dudas antes de continuar?{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-ink/70 underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p className="mt-1">
            Esta página coordina la confianza del trato. El pago se realiza de forma
            manual y segura entre tú y el artista.
          </p>
        </footer>
      </div>
    </main>
  );
}
