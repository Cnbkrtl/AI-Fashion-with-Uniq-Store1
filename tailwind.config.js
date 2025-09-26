/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        fadeInOut: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '20%, 80%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-10px)' },
        },
        pulseBg: {
            '0%, 100%': { backgroundColor: 'rgba(17, 24, 39, 0.8)' },
            '50%': { backgroundColor: 'rgba(31, 41, 55, 0.8)' },
        }
      },
      animation: {
        'fade-in-out': 'fadeInOut 2.8s ease-in-out forwards',
        'pulse-bg': 'pulseBg 3.5s infinite ease-in-out',
      }
    },
  },
  plugins: [
    require('@tailwindcss/aspect-ratio'),
  ],
}