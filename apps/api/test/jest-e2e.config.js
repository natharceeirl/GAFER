/**
 * Configuración de Jest para las pruebas E2E / integración (QA).
 *
 * - Levanta la aplicación NestJS REAL contra un PostgreSQL REAL de pruebas
 *   (base `gafer_test`, nunca la de desarrollo).
 * - Se ejecuta aparte de `pnpm test` para que ese comando siga sin depender de Docker.
 *
 * Uso:  pnpm --filter @gafer/api test:e2e
 *       pnpm --filter @gafer/api test:e2e:cov   (con reporte de cobertura)
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
