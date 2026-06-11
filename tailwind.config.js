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
        darkBg: '#f0f9ff',
        darkSecondary: '#ffffff',
        glowCyan: '#0284c7',
        glowBlue: '#1d4ed8',
        textMuted: '#475569',
      }
    },
  },
  plugins: [],
}
