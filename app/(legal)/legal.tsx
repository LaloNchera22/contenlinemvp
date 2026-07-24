import Link from 'next/link';
import type { ReactNode } from 'react';

/** Marco común para las páginas legales (privacidad, términos, cookies). */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-16">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← Volver
      </Link>
      <h1 className="mt-6 text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted">Última actualización: {updated}</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink">{children}</div>
      <p className="mt-12 text-xs text-muted">
        Este documento es una plantilla informativa y no constituye asesoría legal.
        Consulta con un abogado antes de operar en producción.
      </p>
    </main>
  );
}
