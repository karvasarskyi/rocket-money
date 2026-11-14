/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0A',
        accent: '#00FF88',
        card: '#111111',
        muted: '#8A8F98',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: { neon: '0 0 24px rgba(0,255,136,0.25)' },
    },
  },
  plugins: [],
};
