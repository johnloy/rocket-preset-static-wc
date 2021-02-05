module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  env: {
    browser: true,
    es2020: true,
    mocha: true,
    node: true,
  },
  plugins: [
    '@typescript-eslint',

    // Runs Prettier as an ESLint rule and reports differences as individual ESLint issues.
    // https://github.com/prettier/eslint-plugin-prettier
    'prettier',

    'html',
    'markdown',
    'tsdoc',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended',
  ],
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-var-requires': 0,
    'tsdoc/syntax': 'warn',
  },
  settings: {
    node: {
      extensions: ['.ts', '.json'],
    },
    jsdoc: {
      /*
       * Fixes eslint-plugin-jsdoc's reports: "Invalid JSDoc tag name "template" jsdoc/check-tag-names"
       * refs: https://github.com/gajus/eslint-plugin-jsdoc#check-tag-names
       */
      mode: 'typescript',
    },
    'html/indent': '+2',
    'html/report-bad-indent': 'error',
  },
}
