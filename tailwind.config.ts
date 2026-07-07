import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta inspirada en Supabase: acento verde sobre grises neutros.
        brand: {
          light: '#6EE7B7',
          DEFAULT: '#3ECF8E',
          dim: '#24B47E',
          dark: '#006239',
        },
        surface: {
          DEFAULT: '#121212',
          card: '#1C1C1C',
          border: '#2E2E2E',
        },
      },
    },
  },
  plugins: [],
};

export default config;
