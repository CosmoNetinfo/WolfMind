/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0b0c10',
        darkSecondary: '#1f2833',
        glowCyan: '#66fcf1',
        glowBlue: '#45f3ff',
        textMuted: '#c5c6c7',
      }
    },
  },
  plugins: [],
}
