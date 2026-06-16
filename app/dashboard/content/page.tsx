'use client';

import { useState } from 'react';

export default function ContentPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isExclusive, setIsExclusive] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title.trim()) return;
    setStatus(null);
    setError(null);
    setBusy(true);
    try {
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;

      // 1. Si hay archivo, súbelo primero al bucket correspondiente.
      if (file) {
        setStatus('Subiendo archivo…');
        const fd = new FormData();
        fd.append('file', file);
        fd.append('bucket', isExclusive ? 'exclusive' : 'public');
        const up = await fetch('/api/upload', { method: 'POST', body: fd });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) {
          setError(upData.error || 'No se pudo subir el archivo.');
          return;
        }
        // Exclusivo guarda la ruta; público guarda la URL.
        mediaUrl = isExclusive ? upData.path : upData.url;
        mediaType = file.type.startsWith('image')
          ? 'image'
          : file.type.startsWith('video')
            ? 'video'
            : 'document';
      }

      // 2. Crear el contenido.
      setStatus('Guardando…');
      const r = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          is_exclusive: isExclusive,
          media_url: mediaUrl,
          media_type: mediaType,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(
          r.status === 401
            ? 'Tu sesión expiró. Inicia sesión de nuevo.'
            : data.error || 'No se pudo crear el contenido.',
        );
        return;
      }
      setStatus('Contenido creado.');
      setTitle('');
      setBody('');
      setFile(null);
    } catch {
      setError('Error de red al crear el contenido.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Contenido</h1>
      <p className="text-white/60 text-sm mt-1">
        El contenido exclusivo se sirve mediante signed URLs solo a suscriptores activos.
      </p>

      <div className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="c-title">Título</label>
          <input id="c-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="c-body">Cuerpo</label>
          <textarea
            id="c-body"
            className="input min-h-[120px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="c-file">Archivo (opcional)</label>
          <input
            id="c-file"
            type="file"
            className="input"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isExclusive}
            onChange={(e) => setIsExclusive(e.target.checked)}
          />
          Exclusivo (requiere suscripción activa)
        </label>
        <button onClick={create} disabled={busy} className="btn-primary">
          {busy ? 'Procesando…' : 'Publicar'}
        </button>
        {status && <p className="text-sm text-white/70" role="status" aria-live="polite">{status}</p>}
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      </div>
    </div>
  );
}
