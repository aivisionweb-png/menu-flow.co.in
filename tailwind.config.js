/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#080A0C',
        surface: '#0D1115',
        card: '#12171C',
        elevated: '#171D23',
        ivory: '#F5F2EA',
        muted: '#9BA3AA',
        teal: '#2DD4BF',
        champagne: '#E7C77A'
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'DM Sans', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        premium: '0 24px 80px rgba(0,0,0,.36)',
        teal: '0 0 40px rgba(45,212,191,.12)'
      },
      borderRadius: { '2xl': '1.25rem' }
    }
  },
  plugins: []
};
