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
    extend: {},
  },
  variants: {
    extend: {},
  },
};
