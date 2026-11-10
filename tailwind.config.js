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
      },
      fontFamily: {
        title: ['Poppins', 'system-ui', 'sans-serif'],
        body: ['"Encode Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
