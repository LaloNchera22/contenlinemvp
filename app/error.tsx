'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Frontera de error de la app (Next App Router). Captura excepciones de render en
 * el árbol de rutas y ofrece reintentar (reset) o volver al inicio.
 *
 * En producción NO mostramos el mensaje del error: puede filtrar detalles internos
 * (rutas, nombres de tablas, etc.). En desarrollo sí lo mostramos para depurar.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Punto de enganche para el monitoreo (Sentry, etc.) — ver Production checklist.
    console.error(error);
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card max-w-md text-center">
        <h1 className="text-2xl font-bold">Algo salió mal</h1>
        <p className="mt-2 text-sm text-white/60">
          Ocurrió un error inesperado. Puedes reintentar o volver al inicio.
        </p>
        {isDev && (
          <pre className="mt-4 overflow-x-auto rounded-lg bg-surface p-3 text-left text-xs text-red-400">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ''}
          </pre>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="btn-primary">
            Reintentar
          </button>
          <Link href="/" className="btn-ghost">
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
