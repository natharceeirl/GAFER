module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // El worker importa el código fuente de @gafer/api, que usa kysely (paquete
  // ESM): hay que transformarlo igual que hace la configuración de Jest de la
  // API. El resto de node_modules y los dist/ compilados se requieren tal cual.
  transformIgnorePatterns: ['node_modules/(?!(\\.pnpm|kysely)/)'],
  testEnvironment: 'node',
};
