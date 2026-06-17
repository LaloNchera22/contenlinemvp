'use client';

import { useState } from 'react';

/**
 * Tarjeta de contenido en el perfil público. Para contenido accesible, al hacer
 * clic pide la signed URL a /api/content/[id]/url y la muestra en un modal. El
 * contenido exclusivo bloqueado se renderiza en el server (thumbnail blureado +
 * candado), así que este componente solo se usa para items a los que el visitante
 * SÍ puede acceder; aun así manejamos el 403 por si la suscripción venció entre
 * el render y el clic.
 */
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

  async function openItem() {
    setOpen(true);
    setError(null);
    if (url) return; // ya resuelta
    setLoading(true);
    try {
      const r = await fetch(`/api/content/${id}/url`);
      if (r.status === 403) {
        setError('Suscríbete para acceder a este contenido.');
        return;
      }
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) {
        setError(d.error || 'No se pudo cargar el contenido.');
        return;
      }
      setUrl(d.url);
    } catch {
      setError('Error de red al cargar el contenido.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={openItem}
        className="card text-left w-full aspect-square flex items-center justify-center hover:border-brand transition-colors"
      >
        <span className="text-sm text-white/70 line-clamp-3">{title}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            {loading && <p className="text-center text-white/70" role="status">Cargando…</p>}
            {error && <p className="text-center text-amber-400" role="alert">{error}</p>}
            {url && mediaType === 'video' && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={url} controls className="w-full rounded-xl" />
            )}
            {url && mediaType !== 'video' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={title} className="w-full rounded-xl object-contain" />
            )}
            <button onClick={() => setOpen(false)} className="btn-ghost mt-4 mx-auto block">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
