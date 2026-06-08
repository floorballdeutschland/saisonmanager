/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  darkMode: "class",
  theme: {
    extend: {
      fontSize: {
        "4.5xl": "2.625rem", // 42px / 16
      },
      fontFamily: {
        helvetica: ["Helvetica", "Arial", "sans-serif"],
      },
      colors: {
        "fb-gray-100": "#A9A9A9",
        "fb-gray-200": "#E7E7E7",
        "fb-gray-300": "#FBFBFB",
        "fb-gray-400": "#999999",
        "fb-gray-500": "#616161",
        "fb-gray-600": "#BBBBBB",
        "fb-gray-700": "#E5E5E5",
        "fb-gray-800": "#FAFAFA",
        "fb-gray-900": "#666666",
        primary: {
          // v3-Hex bewusst hartkodiert: tailwindcss/colors liefert in v4 OKLCH,
          // was die Markenfarbe verschöbe. So bleibt primary identisch zu v3.
          DEFAULT: "#0ea5e9", // sky-500 (v3)
          light: "#7dd3fc", // sky-300 (v3)
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
