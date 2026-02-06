/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#0E0F11",
        headerBg: "#14161A",
        bodyText: "#E6E7EB",
        label: "#A0A4AE",
        card: "#020617",
        accent: "#22c55e",
        accentBad: "#ef4444"
      }
    }
  },
  plugins: []
};

