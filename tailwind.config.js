/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        darkBg: '#050609',
        darkSecondary: '#0d0e19',
        glowCyan: '#66fcf1',
        glowBlue: '#818cf8',
        textMuted: '#94a3b8',
      }
    },
  },
  plugins: [],
}
