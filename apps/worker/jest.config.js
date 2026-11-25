module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // Workspace packages resuelven a su dist/*.js compilado (apps/api,
  // packages/contracts) vía symlinks de pnpm: no necesitan pasar por
  // ts-jest, Jest los puede requerir directamente como CommonJS.
  transformIgnorePatterns: ['/node_modules/(?!(\\.pnpm/kysely@|kysely/))'],
  testEnvironment: 'node',
};
