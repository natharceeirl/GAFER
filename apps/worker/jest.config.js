module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // El worker importa el código fuente de @gafer/api, que usa kysely (paquete ESM): se transforma solo
  // kysely; el resto de node_modules y los dist/ se requieren tal cual.
  transformIgnorePatterns: ['/node_modules/(?!(\\.pnpm/kysely@|kysely/))'],
  testEnvironment: 'node',
};
