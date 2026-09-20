/**
 * jest-e2e.config.js
 * Configuración de las pruebas de integración (pnpm test:e2e).
 *
 * Historial de versiones
 *   v1.0  2026-09-20  ahilacondo  Creación del archivo.
 */
module.exports = {
  rootDir: '..', // apps/api
  testRegex: 'test/e2e/.*\\.e2e-spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  transformIgnorePatterns: ['node_modules/(?!(\\.pnpm|kysely)/)'],
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/support/global-setup.ts',
  setupFiles: ['<rootDir>/test/support/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/support/quiet.ts'],
  testTimeout: 30000,
  maxWorkers: 1, // una sola base de datos compartida: los archivos corren en serie

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.doc.ts',
    '!src/main.ts',
    '!src/index.ts',
    '!src/database/migrator.ts',
  ],
  coverageDirectory: 'coverage-e2e',
  coverageReporters: ['text-summary', 'lcov', 'html', 'json-summary'],
};
