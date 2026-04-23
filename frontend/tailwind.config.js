/** @type {import('tailwindcss').Config} */
const mainPalette = {
  50: '#edf3f9',
  100: '#d7e4f1',
  200: '#afc9e3',
  300: '#87add5',
  400: '#5f92c7',
  500: '#002F6C',
  600: '#002a61',
  700: '#002353',
  800: '#001c45',
  900: '#001536',
}

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: mainPalette,
        blue: mainPalette,
        indigo: mainPalette,
        purple: mainPalette,
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
        'card': '0 1px 3px 0 rgba(0, 47, 108, 0.06), 0 1px 2px -1px rgba(0, 47, 108, 0.06)',
        'card-hover': '0 10px 25px -5px rgba(0, 47, 108, 0.1), 0 8px 10px -6px rgba(0, 47, 108, 0.06)',
        'sidebar': '4px 0 24px -4px rgba(49, 65, 87, 0.08)',
      }
    },
  },
  plugins: [],
}
