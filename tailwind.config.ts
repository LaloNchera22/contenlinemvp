import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#7c3aed',
          dark: '#5b21b6',
          light: '#a78bfa',
        },
        surface: {
          DEFAULT: '#0b0b12',
          card: '#15151f',
          border: '#262633',
        },
      },
    },
  },
  plugins: [],
};

export default config;
