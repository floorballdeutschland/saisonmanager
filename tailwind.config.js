function guessProductionMode() {
  const argv = process.argv.join(" ").toLowerCase();
  const isProdEnv = process.env.NODE_ENV === "production";
  return (
    isProdEnv ||
    [" build", ":build", "ng b", "--prod"].some((command) =>
      argv.includes(command)
    )
  );
}

process.env.TAILWIND_MODE = guessProductionMode() ? "build" : "watch";

let fontBase = 16;

let calculateRem = (size) => {
  return size / fontBase + "rem";
};

module.exports = {
  mode: "jit",
  prefix: "",
  purge: ["./src/**/*.{html,ts}"],
  darkMode: "class",
  theme: {
    extend: {
      fontSize: {
        '4.5xl': calculateRem(42),
      },
      fontFamily: {
        helvetica: ['Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        "fb-gray-100": "#A9A9A9",
        "fb-gray-200": "#E7E7E7",
        "fb-gray-300": "#FBFBFB",
        "fb-gray-400": "#999999",
        "fb-gray-500": "#616161",
        "fb-gray-600": "#BBBBBB",
      },
    },
  },
  variants: {
    extend: {},
  },
};
