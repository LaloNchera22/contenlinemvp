'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'contenline-cookie-consent';

/**
 * Banner de consentimiento de cookies. Hoy solo usamos almacenamiento
 * estrictamente necesario, pero el banner deja el aviso accesible y prepara el
 * terreno para activar analítica con consentimiento previo (RGPD / ePrivacy).
 */
export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(localStorage.getItem(KEY) !== 'true');
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sep bg-surface backdrop-blur px-6 py-4">
      <div className="mx-auto flex max-w-4xl flex-col sm:flex-row sm:items-center gap-3 text-sm">
        <p className="text-ink flex-1">
          Usamos solo almacenamiento necesario para autenticarte. Consulta nuestra{' '}
          <Link href="/cookies" className="underline hover:text-ink">
            política de cookies
          </Link>{' '}
          y el{' '}
          <Link href="/privacy" className="underline hover:text-ink">
            aviso de privacidad
          </Link>
          .
        </p>
        <button
          className="btn-primary shrink-0"
          onClick={() => {
            localStorage.setItem(KEY, 'true');
            setShow(false);
          }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
