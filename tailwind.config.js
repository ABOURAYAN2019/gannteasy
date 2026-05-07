/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ocp: {
          green: '#007A3D',
          dark: '#005C2E',
          light: '#E6F4ED',
        }
      }
    },
  },
  plugins: [],
}
