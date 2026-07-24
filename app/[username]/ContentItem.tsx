'use client';

import { useState } from 'react';
import { accentFor } from '@/lib/accents';

/**
 * Tarjeta de contenido en el perfil público, con la anatomía del mosaico:
 * portada 4/5 con el acento del item, píldora de tipo en cristal y titular a dos
 * líneas. Al hacer clic pide la signed URL a /api/content/[id]/url y la muestra
 * en un modal. El contenido exclusivo bloqueado se renderiza en el server, así
 * que aquí solo llegan items accesibles; aun así manejamos el 403 por si la
 * suscripción venció entre el render y el clic.
 */
const TYPE_LABEL: Record<string, string> = {
  video: 'Video',
  image: 'Imagen',
  document: 'Documento',
};

export default function ContentItem({
  id,
  title,
  mediaType,
}: {
  id: string;
  title: string;
  mediaType: 'image' | 'video' | 'document' | null;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const accent = accentFor(id);

  async function openItem() {
    setOpen(true);
    setError(null);
    if (url) return; // ya resuelta
    setLoading(true);
    try {
      const r = await fetch(`/api/content/${id}/url`);
      if (r.status === 403) {
        setError('Tu suscripción no está activa. Suscríbete para ver este contenido.');
        return;
      }
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) {
        setError(d.error || 'No se pudo cargar. Vuelve a intentarlo.');
        return;
      }
      setUrl(d.url);
    } catch {
      setError('Sin conexión. Revisa tu red y vuelve a intentarlo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={openItem}
        className="group flex flex-col rounded-card text-left outline-none transition-opacity hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <div
          className="relative aspect-[4/5] w-full overflow-hidden rounded-card"
          style={{ backgroundColor: accent }}
        >
          <span className="glass absolute bottom-3 left-3 rounded-pill px-3 py-1 text-xs font-medium text-ink">
            {mediaType ? TYPE_LABEL[mediaType] : 'Abrir'}
          </span>
        </div>
        <h3 className="mt-3 line-clamp-2 text-[17px] font-medium leading-snug text-ink">{title}</h3>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {loading && (
              <p className="text-center text-muted" role="status">
                Cargando…
              </p>
            )}
            {error && (
              <p className="text-center text-status-warn" role="alert">
                {error}
              </p>
            )}
            {url && mediaType === 'video' && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={url} controls className="w-full rounded-card" />
            )}
            {url && mediaType !== 'video' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={title} className="w-full rounded-card object-contain" />
            )}
            <button onClick={() => setOpen(false)} className="btn-ghost mx-auto mt-4 block">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
