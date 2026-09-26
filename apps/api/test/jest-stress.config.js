/**
 * jest-stress.config.js
 * Configuración de las pruebas de estrés y concurrencia (pnpm test:stress).
 *
 * Va aparte de jest-e2e.config.js a propósito: esta suite no corre en el
 * pipeline de CI (T3.2 no lo exige, a diferencia de T3.1), porque su objetivo
 * es encontrar problemas de concurrencia y algunos casos pueden quedar en
 * rojo mientras el problema que documentan siga sin corregirse.
 *
 * Historial de versiones
 *   v1.0  2026-09-23  ahilacondo  Creación del archivo.
 */
module.exports = {
  rootDir: '..', // apps/api
  testRegex: 'test/stress/.*\\.stress-spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  transformIgnorePatterns: ['node_modules/(?!(\\.pnpm|kysely)/)'],
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/support/global-setup.ts',
  setupFiles: ['<rootDir>/test/support/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/support/quiet.ts'],
  testTimeout: 60000,
  maxWorkers: 1, // una sola base de datos compartida: los archivos corren en serie
};
