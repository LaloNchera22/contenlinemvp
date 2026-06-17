'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * Diálogo de confirmación reutilizable para acciones destructivas.
 *
 * `requireTypeConfirmation` añade una fricción deliberada: el botón de confirmar
 * queda deshabilitado hasta que el usuario escribe EXACTAMENTE el texto pedido
 * (p. ej. el nombre de la key o "ELIMINAR"). Es la barrera estándar contra
 * borrados accidentales o por clic apresurado en acciones irreversibles.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  danger = false,
  requireTypeConfirmation,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  requireTypeConfirmation?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Reiniciar el texto escrito cada vez que el diálogo se abre, para que una
  // confirmación previa no quede "preaprobada" al reabrirlo.
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  // Cerrar con Escape. El listener vive solo mientras el diálogo está abierto.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    // Mover el foco al botón de cancelar (opción segura) al abrir.
    cancelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmDisabled = requireTypeConfirmation !== undefined && typed !== requireTypeConfirmation;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      // Click fuera del panel (en el backdrop) cancela.
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="card w-full max-w-md"
        // Evita que el click dentro del panel burbujee al backdrop y lo cierre.
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <div id={descId} className="mt-2 text-sm text-white/70">
            {description}
          </div>
        )}

        {requireTypeConfirmation !== undefined && (
          <div className="mt-4">
            <label className="label" htmlFor={`${titleId}-type`}>
              Escribe <span className="font-mono text-white/90">{requireTypeConfirmation}</span> para confirmar
            </label>
            <input
              id={`${titleId}-type`}
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button ref={cancelRef} onClick={onCancel} className="btn-ghost">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`btn ${danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-primary'} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
