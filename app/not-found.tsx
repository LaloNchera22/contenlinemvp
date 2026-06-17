import Link from 'next/link';

/** 404 con el diseño del sistema (en vez del 404 plano por defecto de Next). */
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card max-w-md text-center">
        <p className="text-5xl font-bold text-brand">404</p>
        <h1 className="mt-3 text-xl font-bold">Página no encontrada</h1>
        <p className="mt-2 text-sm text-white/60">
          El enlace puede estar roto o el contenido ya no existe.
        </p>
        <Link href="/" className="btn-primary mt-6 inline-flex">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
