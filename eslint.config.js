// Lints the game's inline script for bugs and unsafe DOM writes.
const js = require("@eslint/js");
const html = require("eslint-plugin-html");
const nounsanitized = require("eslint-plugin-no-unsanitized");
const security = require("eslint-plugin-security");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/", "playwright-report/", "test-results/", "pictures.js", "www/", "android/"] },
  js.configs.recommended,
  {
    files: ["**/*.html"],
    plugins: { html, "no-unsanitized": nounsanitized },
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.browser } },
    rules: {
      // Markup is only written through the html`...` tag, which escapes every value.
      "no-unsanitized/property": ["error", { escape: { taggedTemplates: ["html"] } }],
      "no-unsanitized/method": ["error", { escape: { taggedTemplates: ["html"] } }],
      "no-unused-vars": ["error", { caughtErrors: "none" }],
    },
  },
  {
    files: ["**/*.js"],
    plugins: { security },
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: { ...globals.node, ...globals.browser } },
    rules: { ...security.configs.recommended.rules },
  },
  {
    // Local build script: paths and keys come from this repo, not from users.
    files: ["scripts/**/*.js"],
    rules: { "security/detect-object-injection": "off", "security/detect-non-literal-fs-filename": "off" },
  },
  {
    // Code inside page.evaluate() runs in the game page, where these are globals.
    files: ["tests/**/*.js"],
    languageOptions: { globals: { game: "readonly", TOPICS: "readonly", PICS: "readonly", dealCard: "readonly", quiz: "readonly", GRAMMAR: "readonly", startGame: "readonly", buildDeck: "readonly", artName: "readonly", illustration: "readonly" } },
    // Index lookups on test fixtures are not user input.
    rules: { "security/detect-object-injection": "off", "security/detect-non-literal-regexp": "off" },
  },
];
