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
        darkBg: '#0c0d10',
        darkSecondary: '#16171e',
        glowCyan: '#ffffff',
        glowBlue: '#94a3b8',
        textMuted: '#64748b',
      }
    },
  },
  plugins: [],
}
