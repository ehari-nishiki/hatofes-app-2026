/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hatofes: {
          // These now use CSS variables for theme support
          bg: 'var(--color-bg)',
          black: '#111111',
          dark: 'var(--color-bg-secondary)',
          white: 'var(--color-text-primary)',
          gray: {
            DEFAULT: 'var(--color-text-muted)',
            light: 'var(--color-text-secondary)',
            lighter: 'var(--color-bg-elevated)',
            muted: 'var(--color-text-muted)',
          },
          accent: {
            yellow: 'var(--color-accent-yellow)',
            orange: 'var(--color-accent-orange)',
          },
        },
      },
      fontFamily: {
        sans: [
          'hiragino-kaku-gothic-pron',
          'sans-serif',
        ],
        display: [
          {
            family: 'din-2014',
            fontWeight: '700'
          },
          'sans-serif',
        ],
      },
      boxShadow: {
        'card': '0 0 25px 0 var(--color-shadow)',
      },
    },
  },
  plugins: [],
}
