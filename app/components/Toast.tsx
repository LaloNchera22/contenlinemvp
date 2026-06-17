'use client';

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';

type ToastType = 'info' | 'success' | 'error' | 'loading';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastOptions {
  /** ms hasta auto-cierre. 0 = persistente (hay que cerrarlo manualmente). */
  duration?: number;
}

interface ToastApi {
  info: (message: string, opts?: ToastOptions) => number;
  success: (message: string, opts?: ToastOptions) => number;
  error: (message: string, opts?: ToastOptions) => number;
  /** loading es persistente por defecto: pensado para actualizarlo luego con update(). */
  loading: (message: string, opts?: ToastOptions) => number;
  update: (id: number, type: ToastType, message: string, opts?: ToastOptions) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

// Duraciones por defecto. Los errores se quedan más tiempo (el usuario necesita
// leerlos); loading es persistente porque su ciclo de vida lo controla quien lo
// disparó (sobrevive al popup de la wallet, que puede tardar).
const DEFAULT_DURATION: Record<ToastType, number> = {
  info: 4000,
  success: 4000,
  error: 7000,
  loading: 0,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  // Guardamos los timers por id para poder cancelarlos al actualizar/cerrar un toast.
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const schedule = useCallback(
    (id: number, duration: number) => {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
    },
    [dismiss],
  );

  const push = useCallback(
    (type: ToastType, message: string, opts?: ToastOptions) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, type, message }]);
      schedule(id, opts?.duration ?? DEFAULT_DURATION[type]);
      return id;
    },
    [schedule],
  );

  const update = useCallback(
    (id: number, type: ToastType, message: string, opts?: ToastOptions) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, type, message } : t)));
      schedule(id, opts?.duration ?? DEFAULT_DURATION[type]);
    },
    [schedule],
  );

  const api: ToastApi = {
    info: (m, o) => push('info', m, o),
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, o),
    loading: (m, o) => push('loading', m, o),
    update,
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* top-center en móvil, top-right en desktop. */}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const STYLES: Record<ToastType, string> = {
  info: 'border-surface-border bg-surface-card',
  success: 'border-emerald-500/40 bg-emerald-500/10',
  error: 'border-red-500/40 bg-red-500/10',
  loading: 'border-brand/40 bg-brand/10',
};

const ICONS: Record<ToastType, string> = {
  info: 'ℹ',
  success: '✓',
  error: '✕',
  loading: '⏳',
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return (
    <div
      // Errores como 'alert' (interrumpe al lector de pantalla); el resto como
      // 'status' (anuncio cortés). Cumple el requisito de accesibilidad.
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${STYLES[toast.type]}`}
    >
      <span aria-hidden="true" className={toast.type === 'loading' ? 'animate-pulse' : ''}>
        {ICONS[toast.type]}
      </span>
      <span className="flex-1">{toast.message}</span>
      <button onClick={onClose} aria-label="Cerrar" className="text-white/50 hover:text-white">
        ✕
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
