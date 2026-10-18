/**
 * PostCSS: lo detecta automáticamente el builder de Angular.
 * Tailwind se compila a partir de las directivas de `src/styles.css`.
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
