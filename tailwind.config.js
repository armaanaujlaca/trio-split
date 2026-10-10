/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dae6ff',
          200: '#bdd2ff',
          300: '#8fb4ff',
          400: '#5a8bff',
          500: '#3366ff',
          600: '#2449f0',
          700: '#1c38c7',
          800: '#1b319e',
          900: '#1b2f7d',
          950: '#141d4a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
};
