'use client';

import { useEffect, useState } from 'react';

/**
 * Age-gate para perfiles marcados como contenido adulto (users.is_adult).
 * Bloquea la vista hasta que el visitante confirma ser mayor de edad. La
 * confirmación se recuerda en localStorage para no repetir el aviso.
 *
 * NOTA: esto NO sustituye una verificación de edad real (KYC/2257/DSA); es el
 * mínimo de age-gate. La verificación de identidad de creadores adultos debe
 * implementarse antes de aceptar este tipo de contenido en producción.
 */
export default function AgeGate({ username }: { username: string }) {
  const [confirmed, setConfirmed] = useState(true); // evita flash en SSR
  const storageKey = 'contenline-age-confirmed';

  useEffect(() => {
    setConfirmed(localStorage.getItem(storageKey) === 'true');
  }, []);

  if (confirmed) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-6"
    >
      <div className="card max-w-md text-center">
        <h2 id="age-gate-title" className="text-xl font-bold">
          Contenido para adultos
        </h2>
        <p className="mt-3 text-sm text-white/70">
          El perfil de @{username} contiene material para adultos. Debes ser mayor de
          edad en tu jurisdicción para continuar.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <a href="/" className="btn-ghost">
            Salir
          </a>
          <button
            className="btn-primary"
            onClick={() => {
              localStorage.setItem(storageKey, 'true');
              setConfirmed(true);
            }}
          >
            Soy mayor de edad
          </button>
        </div>
      </div>
    </div>
  );
}
