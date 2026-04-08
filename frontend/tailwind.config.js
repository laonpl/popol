/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef4ff',
          100: '#dae6ff',
          200: '#bdd4ff',
          300: '#90baff',
          400: '#6199fc',
          500: '#3778f9',
          600: '#2660ed',
          700: '#1e4cd9',
          800: '#1f3fb0',
          900: '#1f398b',
        },
        bluewood: {
          50: '#f4f6f8',
          100: '#e3e8ed',
          200: '#c9d2dc',
          300: '#a4b2c2',
          400: '#788ca1',
          500: '#5d7186',
          600: '#4f5f72',
          700: '#445060',
          800: '#3c4551',
          900: '#314157',
        },
        caribbean: {
          50: '#eefff5',
          100: '#d7ffe9',
          200: '#b2ffd5',
          300: '#76ffb5',
          400: '#33f58e',
          500: '#09dd6d',
          600: '#04bd5e',
          700: '#06944b',
          800: '#0a743e',
          900: '#0a5f35',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
        }
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(55, 120, 249, 0.06), 0 1px 2px -1px rgba(55, 120, 249, 0.06)',
        'card-hover': '0 10px 25px -5px rgba(55, 120, 249, 0.1), 0 8px 10px -6px rgba(55, 120, 249, 0.06)',
        'sidebar': '4px 0 24px -4px rgba(49, 65, 87, 0.08)',
      }
    },
  },
  plugins: [],
}
