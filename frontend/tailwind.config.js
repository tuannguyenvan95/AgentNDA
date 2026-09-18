/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F9F8F6',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#111827',
          secondary: '#374151',
          muted: '#6B7280',
          faint: '#9CA3AF',
        },
        line: {
          DEFAULT: '#E5E5E0',
          dark: '#D1D1CB',
          subtle: '#EFEFEA',
        },
        crimson: {
          DEFAULT: '#B91C1C',
          dark: '#991B1B',
          subtle: '#FEF2F2',
          border: '#FCA5A5',
        },
        forest: {
          DEFAULT: '#15803D',
          dark: '#166534',
          subtle: '#F0FDF4',
          border: '#86EFAC',
        },
        amber: {
          DEFAULT: '#B45309',
          subtle: '#FFFBEB',
          border: '#FCD34D',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'Cambria', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        press: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'press-md': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      },
    },
  },
  plugins: [],
};
