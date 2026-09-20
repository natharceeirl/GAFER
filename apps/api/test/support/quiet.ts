// Silencia el ruido que no aporta a los reportes:
//  - el interceptor de auditoría imprime cada request con console.log
//  - dotenv avisa "injected env" por console.error
const errorOriginal = console.error.bind(console);

jest.spyOn(console, 'log').mockImplementation(() => undefined);
jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('injected env')) return;
  errorOriginal(...args);
});
