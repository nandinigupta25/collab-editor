/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        editor: ['"Crimson Pro"', 'Georgia', 'serif'],
      },
      colors: {
        ink: {
          50:  '#f7f6f3',
          100: '#edeae3',
          200: '#d8d2c4',
          300: '#bfb59f',
          400: '#a0937a',
          500: '#877a62',
          600: '#706455',
          700: '#5c5247',
          800: '#4d453d',
          900: '#423b35',
          950: '#231f1b',
        },
        canvas: '#faf9f7',
        accent: '#2563EB',
      },
      boxShadow: {
        'page': '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)',
        'sidebar': '2px 0 8px rgba(0,0,0,0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideIn: { from: { transform: 'translateX(-8px)', opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
        pulseDot: { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
      },
    },
  },
  plugins: [],
};
