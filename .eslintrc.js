module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    node: true,
  },
  plugins: ['prettier'],
  extends: ['eslint:recommended', 'google', 'prettier'],
  rules: {
    'prettier/prettier': ['warn'],
    'prefer-template': ['warn'],
    'no-debugger': ['warn'],
    'brace-style': ['error', '1tbs', {allowSingleLine: true}],
    eqeqeq: ['error', 'always'],
    curly: ['error', 'multi-or-nest', 'consistent'],
  },
};
