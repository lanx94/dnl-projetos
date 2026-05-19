/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FCFBF7',
          100: '#FAF9F4',
          200: '#F2F0E8',
          300: '#E8E5D9',
          400: '#D4D0BF'
        },
        ink: {
          900: '#0A0A0A',
          800: '#1A1A1A',
          700: '#2A2A2A',
          600: '#4A4A47',
          500: '#6A6A66',
          400: '#9A9A95',
          300: '#BFBFB8'
        },
        terra: {
          50: '#FBF1EC',
          100: '#F4DDD0',
          400: '#D8825A',
          500: '#C75D2C',
          600: '#A84A1F',
          700: '#7E3815'
        },
        moss: {
          500: '#5D7B4A',
          600: '#4A6238'
        }
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'monospace']
      },
      letterSpacing: {
        tightest: '-0.04em'
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgba(10, 10, 10, 0.04), 0 1px 3px 0 rgba(10, 10, 10, 0.06)',
        lift: '0 4px 12px -2px rgba(10, 10, 10, 0.08), 0 2px 4px -1px rgba(10, 10, 10, 0.04)'
      }
    }
  },
  plugins: []
}
