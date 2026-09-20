/**
 * quiet.ts
 * Oculta mensajes innecesarios en la consola durante las pruebas.
 *
 * Historial de versiones
 *   v1.0  2026-09-20  ahilacondo  Creación del archivo.
 */
const errorOriginal = console.error.bind(console);

jest.spyOn(console, 'log').mockImplementation(() => undefined);
jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('injected env')) return;
  errorOriginal(...args);
});
