import Link from 'next/link';
import { accentFor, type Accent } from '@/lib/accents';

/**
 * El mosaico central del marketplace. Anatomía, de arriba abajo:
 *   1. Portada 4/5, object-cover, radio de card. Sin video aún → campo sólido
 *      del acento del reto. El acento vive aquí y en ningún otro sitio de la
 *      tarjeta: la interfaz es el marco, el reto es el objeto.
 *   2. Píldora de estado en cristal, abajo-izquierda. Nunca solo color: lleva
 *      texto siempre.
 *   3. Titular 17px/500, máximo dos líneas.
 *   4. Importe en mono con .money, y debajo el caption creador · cadena.
 *
 * La tarjeta entera es el enlace: en una vista de grid no hay botón primario por
 * tarjeta (un solo botón primario por vista); el CTA vive en la vista de detalle.
 */
export default function ChallengeCard({
  id,
  title,
  amountUsdc,
  creator,
  chain = 'Polygon',
  statusLabel,
  coverUrl,
  accent,
  href,
}: {
  id: string;
  title: string;
  amountUsdc: number;
  creator: string;
  chain?: string;
  statusLabel?: string;
  coverUrl?: string | null;
  accent?: Accent;
  href?: string;
}) {
  const color = accent ?? accentFor(id);

  const body = (
    <>
      <div
        className="relative aspect-[4/5] w-full overflow-hidden rounded-card"
        style={{ backgroundColor: color }}
      >
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        )}
        {statusLabel && (
          <span className="glass absolute bottom-3 left-3 rounded-pill px-3 py-1 text-xs font-medium text-ink">
            {statusLabel}
          </span>
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 text-[17px] font-medium leading-snug text-ink">
        {title}
      </h3>
      <p className="money mt-1 text-[15px] font-medium text-ink">
        ${amountUsdc.toFixed(2)} <span className="text-muted">USDC</span>
      </p>
      <p className="t-caption mt-0.5 text-muted">
        {creator} · {chain}
      </p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group flex flex-col rounded-card outline-none transition-opacity hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {body}
      </Link>
    );
  }
  return <article className="flex flex-col">{body}</article>;
}
