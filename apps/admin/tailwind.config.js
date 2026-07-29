/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Chrome (sidebar/header) — bleu-nuit profond, salle de commandement
        nuit: {
          950: '#0B1220',
          900: '#10192E',
          800: '#1A2740',
          700: '#28395A',
        },
        // Accent institutionnel — bleu profond, actions et éléments actifs
        institution: {
          50: '#EBF2FA',
          100: '#D3E3F5',
          600: '#2C5282',
          700: '#234269',
        },
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
