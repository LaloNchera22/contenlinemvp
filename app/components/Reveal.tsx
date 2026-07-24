'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Aparición al hacer scroll: translateY(20px) + opacidad 0 → estado final, una
 * sola vez por elemento, escalonada 60ms entre mosaicos. La curva y la duración
 * viven en la clase .reveal (globals.css).
 *
 * Mejora progresiva: el estado oculto solo se aplica cuando el JS corre y el
 * usuario no pidió menos movimiento. Sin JS, con IntersectionObserver ausente o
 * con prefers-reduced-motion: reduce, el contenido queda visible de entrada.
 */
export default function Reveal({
  children,
  index = 0,
  className,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') return;

    el.style.transitionDelay = `${Math.min(index, 8) * 60}ms`;
    el.classList.add('reveal');

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('is-visible');
            io.unobserve(el); // una sola vez
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [index]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
