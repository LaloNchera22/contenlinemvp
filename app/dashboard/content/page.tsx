'use client';

import { useState } from 'react';

export default function ContentPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isExclusive, setIsExclusive] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  async function create() {
    if (!title.trim()) return;
    setStatus(null);
    const r = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, is_exclusive: isExclusive }),
    });
    if (r.ok) {
      setStatus('Contenido creado.');
      setTitle('');
      setBody('');
    } else {
      setStatus('Error al crear (¿iniciaste sesión?).');
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Contenido</h1>
      <p className="text-white/50 text-sm mt-1">
        El contenido exclusivo se sirve mediante signed URLs solo a suscriptores activos.
      </p>

      <div className="card mt-6 space-y-4">
        <div>
          <label className="label">Título</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Cuerpo</label>
          <textarea
            className="input min-h-[120px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
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
        <button onClick={create} className="btn-primary">
          Publicar
        </button>
        {status && <p className="text-sm text-white/60">{status}</p>}
      </div>
    </div>
  );
}
