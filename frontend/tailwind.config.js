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
          50: '#ffffff',
          100: '#f8fafc',
          200: '#f1f5f9',
          300: '#e2e8f0',
          400: '#cbd5e1',
          500: '#94a3b8',
          600: '#ffffff',
          700: '#f1f5f9',
          800: '#e2e8f0',
          900: '#cbd5e1',
          950: '#94a3b8',
        }
      }
    },
  },
  plugins: [],
}
