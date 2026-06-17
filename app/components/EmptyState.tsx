/**
 * Estado vacío reutilizable. Centraliza el patrón "card centrada con mensaje +
 * CTA opcional" que ya se repetía inline en varias páginas (planes, earnings),
 * para que todas las listas vacías se vean iguales.
 */
export default function EmptyState({
  title,
  description,
  icon = '✨',
  action,
}: {
  title: string;
  description?: string;
  icon?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card text-center py-12">
      <div className="text-3xl" aria-hidden>
        {icon}
      </div>
      <p className="mt-3 font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-white/60">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
