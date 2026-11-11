/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#1E398D', light: '#3D66E0', glow: '#5B8CFF' },
        accent: '#F9E000',
        ok: 'hsl(128 53% 50%)',
        alert: 'hsl(0 84% 60%)',
        ink: '#05070f',
        surface: '#0b1126', // painéis de vidro por cima do 3D
      },
      // tokens de movimento (os mesmos de :root em index.css)
      transitionDuration: { instant: '100ms', fast: '150ms', base: '250ms', slow: '400ms' },
      transitionTimingFunction: { out: 'cubic-bezier(0.2, 0, 0, 1)' },
      fontFamily: {
        title: ['Poppins', 'system-ui', 'sans-serif'],
        body: ['"Encode Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
