import { ColaPdfBullmq } from './cola-pdf-bullmq';

describe('ColaPdfBullmq con Redis caído', () => {
  const original = process.env.REDIS_URL;
  afterEach(() => {
    delete process.env.REDIS_ENCOLAR_TIEMPO_MS;
    if (original === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = original;
  });

  it('falla en pocos segundos con un error claro en vez de quedarse colgada', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:1'; // puerto sin servicio
    process.env.REDIS_ENCOLAR_TIEMPO_MS = '500';
    const cola = new ColaPdfBullmq();
    const inicio = Date.now();
    await expect(cola.encolar('doc-1')).rejects.toThrow(/Redis/);
    expect(Date.now() - inicio).toBeLessThan(3000);
    // Y se puede volver a intentar sin quedar en un estado roto.
    await expect(cola.encolar('doc-1')).rejects.toThrow(/Redis/);
    await cola.onModuleDestroy();
  }, 10_000);
});
