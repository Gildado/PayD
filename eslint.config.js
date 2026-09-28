// Root-level ESLint flat config (ESLint v10).
// Frontend has its own eslint.config.js inside frontend/.
// This root config ignores everything so lint-staged can run without error
// when non-frontend files (SQL, Rust, TOML, Markdown, …) are staged.
// TypeScript/JavaScript files under frontend/ are linted by the scoped config.

export default [
  {
    ignores: ["**"],
  },
];
