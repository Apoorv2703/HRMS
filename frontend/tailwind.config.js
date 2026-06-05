/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebedff',
          200: '#dbe0ff',
          300: '#c2c9ff',
          400: '#a1a9ff',
          500: '#7680ff',
          600: '#5254f6',
          700: '#4343db',
          800: '#3737b2',
          900: '#2e2e8e',
          950: '#1b1b53',
        }
      }
    },
  },
  plugins: [],
}
