/** @type {import('tailwindcss').Config} */
const mainPalette = {
  50: '#f8f8f6',
  100: '#eeeeeb',
  200: '#dadad5',
  300: '#b9b9b2',
  400: '#85857e',
  500: '#32322e',
  600: '#242421',
  700: '#1c1c1a',
  800: '#151514',
  900: '#101010',
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
          50: '#f8f8f6',
          100: '#eeeeeb',
          200: '#dcdcd7',
          300: '#b7b7b0',
          400: '#81817b',
          500: '#65655e',
          600: '#50504b',
          700: '#393936',
          800: '#242421',
          900: '#111111',
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
          50: '#fbfbf9',
          100: '#f4f4f1',
          200: '#e9e9e4',
          300: '#d7d7d0',
        }
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 3px 0 rgba(17, 17, 17, 0.08)',
        'card-hover': '0 7px 0 rgba(17, 17, 17, 0.1)',
        'sidebar': '4px 0 24px -4px rgba(17, 17, 17, 0.08)',
      }
    },
  },
  plugins: [],
}
