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
        // Ghana flag palette — official GRLF brand colors.
        // Pure hex anchored at 500; tints / shades derived either side.
        ghanaRed: {
          50: "#fff1f1",
          100: "#ffe0e0",
          200: "#ffb8b8",
          300: "#ff7a7a",
          400: "#ff3d3d",
          500: "#ff0000", // brand red
          600: "#cc0000",
          700: "#a00000",
          800: "#7a0000",
          900: "#570000",
          950: "#2e0000",
        },
        ghanaYellow: {
          50: "#fffff0",
          100: "#ffffcc",
          200: "#ffff99",
          300: "#ffff66",
          400: "#ffff33",
          500: "#ffff00", // brand yellow
          600: "#cccc00",
          700: "#999900",
          800: "#666600",
          900: "#333300",
          950: "#1a1a00",
        },
        ghanaGreen: {
          50: "#e8f5e8",
          100: "#c8e6c8",
          200: "#9bd49b",
          300: "#66bb66",
          400: "#339a33",
          500: "#008000", // brand green
          600: "#006a00",
          700: "#005200",
          800: "#003e00",
          900: "#002900",
          950: "#001700",
        },
      },
      fontFamily: {
        display: ["var(--font-anton)", "Impact", "system-ui", "sans-serif"],
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
