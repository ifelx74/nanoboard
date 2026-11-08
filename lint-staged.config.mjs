/**
 * lint-staged config for the pre-commit hook (see `.husky/pre-commit`).
 * Runs Prettier and ESLint on staged files only — fast and targeted, so
 * commits stay unblocked while formatting/lint drift is caught locally.
 * Full build/test/lint remain CI and manual gates.
 *
 * When a locale resource file is staged, also run the i18n usage report
 * and parity check (both plain-Node and fast), so a half-translated locale
 * cannot be committed.
 */
export default {
  "*.{ts,tsx}": ["prettier --write", "eslint --fix"],
  "*.{json,mjs,md}": (files) => {
    const commands = [`prettier --write ${files.join(" ")}`];
    const touchesLocales = files.some((file) =>
      file.includes("src/lib/i18n/locales/"),
    );
    if (touchesLocales) {
      commands.push("pnpm --filter web i18n:report");
      commands.push("pnpm --filter web i18n:check");
    }
    return commands;
  },
};
