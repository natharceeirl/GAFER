/**
 * Regla de dependencia de Feature-Sliced Design: cada capa solo puede
 * importar de sí misma o de capas más abajo (app > pages > widgets >
 * features > entities > shared). Esto es una regla enforceable, no una
 * convención de carpetas.
 */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'import'],
  ignorePatterns: ['dist', 'dev-dist', '*.cjs'],
  settings: {
    'import/resolver': {
      node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
    },
  },
  rules: {
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          { target: './src/shared', from: './src/entities' },
          { target: './src/shared', from: './src/features' },
          { target: './src/shared', from: './src/widgets' },
          { target: './src/shared', from: './src/pages' },
          { target: './src/shared', from: './src/app' },

          { target: './src/entities', from: './src/features' },
          { target: './src/entities', from: './src/widgets' },
          { target: './src/entities', from: './src/pages' },
          { target: './src/entities', from: './src/app' },

          { target: './src/features', from: './src/widgets' },
          { target: './src/features', from: './src/pages' },
          { target: './src/features', from: './src/app' },

          { target: './src/widgets', from: './src/pages' },
          { target: './src/widgets', from: './src/app' },

          { target: './src/pages', from: './src/app' }
        ]
      }
    ]
  }
};
