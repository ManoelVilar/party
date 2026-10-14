/* ESLint 9 (flat config). Foco: erros reais (variável não declarada, duplicada, código morto), não estilo. */
const globals = require("globals");
module.exports = [
  { ignores: ["node_modules/**", "tests/**", "scripts/**", "index.html"] },
  {
    files: [".cache/app.js"],
    languageOptions: {
      ecmaVersion: 2022, sourceType: "script",
      globals: { ...globals.browser, firebase: "readonly", YT: "readonly", pdfjsLib: "readonly" }
    },
    rules: {
      "no-undef": "error", "no-redeclare": "error", "no-dupe-keys": "error", "use-isnan": "error", "valid-typeof": "error",
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      "no-unreachable": "warn", "no-empty": ["warn", { allowEmptyCatch: true }], "no-self-assign": "warn",
      "no-constant-condition": "warn", "no-fallthrough": "warn", "no-loss-of-precision": "warn",
      "no-cond-assign": ["warn", "except-parens"], "no-prototype-builtins": "warn"
    }
  }
];
