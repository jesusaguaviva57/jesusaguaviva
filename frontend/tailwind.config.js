/** @type {import('tailwindcss').Config} */
module.exports = {
  // El modo oscuro se controla con la clase `dark` en <html>: así el usuario
  // puede forzarlo con el botón y, si no lo hace, seguimos lo que diga el
  // navegador (prefers-color-scheme). Ver `ThemeService`.
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        /* Azules sobrios: confianza, sin estridencias. */
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bfd3fe',
          300: '#93b4fd',
          400: '#608afa',
          500: '#3b6bf6',
          600: '#254dea',
          700: '#1d3bcf',
          800: '#1e33a8',
          900: '#1e3085',
          950: '#172054',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        /* Para el texto bíblico: más legible en bloques largos. */
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.18)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 220ms ease-out both',
      },
    },
  },
  plugins: [],
};
