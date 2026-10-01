import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope Variable', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
