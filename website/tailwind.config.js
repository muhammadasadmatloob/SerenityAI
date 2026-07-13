/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#14b8a6', // Teal 500
        'primary-dark': '#0d9488', // Teal 600
        'primary-light': '#5eead4', // Teal 300
        secondary: '#020617', // Slate 950
        accent: '#facc15', // Yellow 400
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, #020617 0%, #064e3b 100%)',
      }
    },
  },
  plugins: [],
}
