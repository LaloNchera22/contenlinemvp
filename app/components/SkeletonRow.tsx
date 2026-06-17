/**
 * Fila skeleton para listas que cargan de forma asíncrona. Evita el salto de
 * layout (CLS) y comunica "cargando" sin un spinner genérico. `cols` ajusta el
 * número de bloques para parecerse a la tabla destino.
 */
export default function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="card flex items-center gap-4" aria-hidden>
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          className="h-4 flex-1 animate-pulse rounded bg-surface-border/60"
        />
      ))}
    </div>
  );
}
