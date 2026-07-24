import type { Config } from 'tailwindcss';

/**
 * Paleta reemplazada por completo (no extendida): al quitar `brand` y `surface`
 * verdes, cualquier resto de la estética vieja falla al compilar. El chrome es
 * acromático — blancos, negros y grises que viven en variables CSS y cambian
 * entre claro y oscuro. El color lo pone el contenido vía los ocho `accent`.
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',
      black: '#000000',
      // Chrome acromático, resuelto en runtime según claro/oscuro.
      bg: 'var(--bg)',
      surface: 'var(--surface)',
      ink: 'var(--text)',
      muted: 'var(--text2)',
      sep: 'var(--sep)',
      // Rojo funcional para acciones destructivas (fondo sólido, texto blanco).
      danger: '#C0392B',
      // Colores de estado para TEXTO de feedback (error/ok/aviso). Cambian por
      // tema para mantener AA sobre fondo claro y oscuro: son señal funcional,
      // como los acentos, no color de marca en el chrome.
      status: {
        danger: 'var(--st-danger)',
        ok: 'var(--st-ok)',
        warn: 'var(--st-warn)',
      },
      // Ocho acentos de contenido, todos ≥4.5:1 con texto blanco encima.
      accent: {
        red: '#C0392B',
        amber: '#A15300',
        green: '#1D7A4D',
        teal: '#0F6E6E',
        blue: '#2C5FD8',
        purple: '#6B2FBF',
        pink: '#B02E6E',
        gray: '#4A4A4F',
      },
    },
    fontFamily: {
      sans: [
        '-apple-system',
        'BlinkMacSystemFont',
        'var(--font-inter)',
        "'Segoe UI'",
        'sans-serif',
      ],
      mono: [
        'ui-monospace',
        "'SF Mono'",
        'var(--font-geist-mono)',
        'Menlo',
        'monospace',
      ],
    },
    borderRadius: {
      none: '0',
      control: '12px',
      card: '18px',
      sheet: '28px',
      pill: '999px',
      full: '9999px',
    },
    extend: {},
  },
  plugins: [],
};

export default config;
