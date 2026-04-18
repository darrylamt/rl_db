import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f0f3f8",
          100: "#d9e0ec",
          200: "#aebcd2",
          300: "#7e92b3",
          400: "#506c95",
          500: "#2f4d7a",
          600: "#1f3a63",
          700: "#152a4a",
          800: "#0e1e36",
          900: "#081529",
          950: "#040b1a",
        },
        gold: {
          50: "#fdf9ec",
          100: "#faf0c6",
          200: "#f5e089",
          300: "#efc94b",
          400: "#e8b325",
          500: "#d59615",
          600: "#b27411",
          700: "#8c5612",
          800: "#744615",
          900: "#633b17",
          950: "#391f09",
        },
      },
      fontFamily: {
        display: ["var(--font-oswald)", "Impact", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
