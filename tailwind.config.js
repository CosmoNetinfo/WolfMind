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
        darkBg: '#090a0f',
        darkSecondary: '#12141c',
        glowCyan: '#38bdf8',
        glowBlue: '#1d4ed8',
        textMuted: '#64748b',
      }
    },
  },
  plugins: [],
}
