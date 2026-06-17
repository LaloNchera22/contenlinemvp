/**
 * Placeholders de carga. Reservan el mismo espacio que el contenido real para
 * evitar el "layout shift" (CLS) cuando llegan los datos, y comunican al usuario
 * que algo está cargando en vez de mostrar un vacío que parece un error.
 *
 * Server-component friendly: sin estado ni hooks, solo markup con animate-pulse.
 */

export function Skeleton({
  className = '',
  rounded = 'rounded',
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`animate-pulse bg-surface-border/60 ${rounded} ${className}`}
      aria-hidden="true"
    />
  );
}

/** Varias líneas de texto. `lines` controla cuántas; la última sale más corta. */
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

/** Tarjeta completa: un título corto + un par de líneas. Imita .card. */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card ${className}`} aria-hidden="true">
      <Skeleton className="h-4 w-1/3 mb-3" />
      <Skeleton className="h-7 w-2/3" />
    </div>
  );
}

/** Fila de tabla/lista: pensada para listados de transacciones, keys, etc. */
export function SkeletonRow({ className = '' }: { className?: string }) {
  return (
    <div className={`card flex items-center justify-between gap-4 ${className}`} aria-hidden="true">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  );
}
