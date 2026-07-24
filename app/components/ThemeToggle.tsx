'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

/**
 * Toggle manual de tema. Escribe `data-theme` en <html> y persiste la elección
 * en localStorage; el script inline de layout.tsx aplica el valor guardado
 * antes del primer paint para evitar el flash. "system" borra el override y
 * vuelve a seguir prefers-color-scheme.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const stored = (localStorage.getItem('theme') as Theme | null) ?? 'system';
    setTheme(stored);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    const root = document.documentElement;
    if (next === 'system') {
      root.removeAttribute('data-theme');
      localStorage.removeItem('theme');
    } else {
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    }
  }

  // Cicla claro → oscuro → sistema.
  const order: Theme[] = ['light', 'dark', 'system'];
  const label = { light: 'Claro', dark: 'Oscuro', system: 'Sistema' }[theme];
  const icon = { light: '☀', dark: '☾', system: '◐' }[theme];

  return (
    <button
      type="button"
      onClick={() => apply(order[(order.indexOf(theme) + 1) % order.length])}
      className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-pill border border-sep bg-surface px-3 text-xs font-medium text-ink transition-colors hover:border-muted"
      aria-label={`Tema: ${label}. Cambiar`}
      title={`Tema: ${label}`}
    >
      <span aria-hidden>{icon}</span>
    </button>
  );
}
