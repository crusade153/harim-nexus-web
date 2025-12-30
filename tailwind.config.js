/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        harim: {
          red: '#E31E24',
          darkRed: '#B00E14',
        }
      }
    },
  },
  plugins: [],
}