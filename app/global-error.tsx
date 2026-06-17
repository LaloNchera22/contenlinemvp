'use client';

import { useEffect } from 'react';

/**
 * Frontera de error de ÚLTIMO recurso: captura fallos en el propio root layout
 * (donde error.tsx ya no aplica). Debe renderizar sus propios <html>/<body>
 * porque reemplaza el layout raíz. Mantenemos estilos inline para no depender de
 * que el CSS global haya cargado en este estado degradado.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0b12',
          color: '#e5e5ef',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Error crítico</h1>
          <p style={{ marginTop: 8, color: 'rgba(229,229,239,0.6)', fontSize: 14 }}>
            La aplicación no pudo cargarse. Intenta recargar la página.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: '8px 16px',
              borderRadius: 8,
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Recargar
          </button>
        </div>
      </body>
    </html>
  );
}
