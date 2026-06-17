/**
 * Estado vacío consistente: ilustración + título + descripción + CTA opcional.
 * Un listado vacío sin contexto parece roto; aquí orientamos al creador sobre
 * QUÉ hacer a continuación (la acción que desbloquea el resto del producto).
 *
 * El CTA acepta `onAction` (botón) o `href` (link), no ambos. La ilustración es
 * un SVG inline neutro para no arrastrar assets ni dependencias.
 */
export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  href,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
}) {
  return (
    <div className="card text-center py-12 flex flex-col items-center">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-white/30 mb-4"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 14h8M8 17h5" />
      </svg>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-white/60 mt-1 max-w-sm">{description}</p>
      {actionLabel && href && (
        <a href={href} className="btn-primary mt-5">
          {actionLabel}
        </a>
      )}
      {actionLabel && onAction && !href && (
        <button onClick={onAction} className="btn-primary mt-5">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
