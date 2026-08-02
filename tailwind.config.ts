import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Branding «adie»: rojo vivo del logotipo sobre superficies blancas.
        brand: {
          light: '#FF5A52',
          DEFAULT: '#F5261C', // rojo principal del logo
          dim: '#D01810',
          dark: '#A5100A',
        },
        surface: {
          // Tema claro: página blanca, tiles/inputs gris muy tenue, bordes suaves.
          DEFAULT: '#F6F6F7',
          card: '#FFFFFF',
          border: '#E7E7EA',
        },
        // Tinta: color de texto principal. `text-ink`, `text-ink/60`, etc.
        // sustituyen al antiguo `text-white` del tema oscuro.
        ink: {
          DEFAULT: '#18181B',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(24,24,27,0.04), 0 4px 16px rgba(24,24,27,0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
