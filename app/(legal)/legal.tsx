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
      <Link href="/" className="text-sm text-ink/60 hover:text-ink">
        ← Volver
      </Link>
      <h1 className="mt-6 text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-ink/60">Última actualización: {updated}</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink/80">{children}</div>
      <p className="mt-12 text-xs text-ink/50">
        Este documento es una plantilla informativa y no constituye asesoría legal.
        Consulta con un abogado antes de operar en producción.
      </p>
    </main>
  );
}
