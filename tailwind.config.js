/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: '#FAF8F3',
        charcoal: '#202020',
        brandBlue: {
          DEFAULT: '#38A3D6',
          dark: '#2287B8',
          light: '#E3F3FA',
        },
        lavender: '#DCD4F2',
        peach: '#F5D5C5',
        mint: '#D9E9DC',
        warmYellow: '#F3E4A9',
        softGrey: '#E9E7E2',
      },
      fontFamily: {
        heading: ['"DM Serif Display"', 'serif'],
        serif: ['"DM Serif Display"', 'serif'],
        sans: ['"Nunito Sans"', 'sans-serif'],
      },
      boxShadow: {
        'editorial': '0 4px 20px -2px rgba(32, 32, 32, 0.06), 0 1px 3px -1px rgba(32, 32, 32, 0.04)',
        'editorial-hover': '0 12px 32px -4px rgba(32, 32, 32, 0.1), 0 4px 10px -2px rgba(32, 32, 32, 0.05)',
      }
    },
  },
  plugins: [],
}
