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
          bg: '#1a1a1a',
          black: '#111111',
          dark: '#0d0d0d',
          white: '#ffffff',
          gray: {
            DEFAULT: '#666666',
            light: '#8a8a8a',
            lighter: '#2a2a2a',
            muted: '#909090',
          },
          accent: {
            yellow: '#FFC300',
            orange: '#FF4E00',
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
        'card': '0 0 25px 0 rgba(255, 255, 255, 0.3)',
      },
    },
  },
  plugins: [],
}
