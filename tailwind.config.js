/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "spring-green": "#8fe58b",
        "spring-blue": "#a0d2eb",
        "spring-lavender": "#d1b3de",
        "spring-pink": "#ffb6c1",
        "spring-yellow": "#ffefd6",
        "spring-peach": "#ffd1ba",
        "spring-accent": "#dd7596",
        "app-bg": "#2f4f4f",
        "app-darker": "#1e3535",
        "app-card": "#3a5c5c",
        "app-input": "#2f4f4f",
        "text-white": "#f5f5f5"
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}