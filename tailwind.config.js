/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class', // lets us use .dark-mode on .app-shell
  theme: {
    extend: {
      colors: {
        brand: {
          navy: 'var(--text-primary, #24203F)', // switches in dark mode
          purple: 'var(--brand-purple, #6C4CE0)', // switches in dark mode
          light: 'var(--brand-light, #F5F4FB)', // switches in dark mode
        },
        // Add these so you can use them directly
        'app-bg': 'var(--app-bg)',
        'surface': 'var(--surface)',
        'border': 'var(--border)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
