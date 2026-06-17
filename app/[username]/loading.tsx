import { Skeleton, SkeletonText } from '@/app/components/Skeleton';

/**
 * Esqueleto del perfil público mientras el server resuelve los datos del creador.
 * Replica la estructura de page.tsx (cabecera, grid de planes, grid de contenido)
 * para que el cambio a contenido real no provoque saltos de layout.
 */
export default function CreatorLoading() {
  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-16" role="status" aria-label="Cargando perfil">
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20" rounded="rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      <SkeletonText lines={2} className="mt-6" />

      <Skeleton className="h-5 w-48 mt-12" />
      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        ))}
      </div>

      <Skeleton className="h-5 w-40 mt-12" />
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square" rounded="rounded-xl" />
        ))}
      </div>
    </main>
  );
}
