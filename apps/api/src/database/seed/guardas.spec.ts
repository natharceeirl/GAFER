import {
  describirDestino,
  exigirDestinoConfirmado,
  leerDestino,
  leerOpcionesSeed,
  verificarEntorno,
} from './guardas';

const URL_LOCAL = 'postgresql://gafer:secreto-del-test@localhost:55436/gafer_test';

describe('Guardas de seguridad de db:seed:demo', () => {
  describe('opciones', () => {
    it('sin argumentos siembra, sin regenerar claves ni confirmar destino remoto', () => {
      expect(leerOpcionesSeed([])).toEqual({ limpiar: false, regenerarClaves: false, confirmarDestinoRemoto: false });
    });

    it('reconoce --limpiar, --regenerar-claves y --confirmar-destino-remoto', () => {
      expect(leerOpcionesSeed(['--limpiar'])).toMatchObject({ limpiar: true });
      expect(leerOpcionesSeed(['--regenerar-claves'])).toMatchObject({ regenerarClaves: true });
      expect(leerOpcionesSeed(['--confirmar-destino-remoto'])).toMatchObject({ confirmarDestinoRemoto: true });
    });

    it('rechaza argumentos desconocidos y la combinación de limpiar con regenerar claves', () => {
      expect(() => leerOpcionesSeed(['--todo'])).toThrow(/--todo/);
      expect(() => leerOpcionesSeed(['--clave', 'algo'])).toThrow(/--clave/);
      expect(() => leerOpcionesSeed(['--limpiar', '--regenerar-claves'])).toThrow(/no se combinan/i);
    });
  });

  describe('entorno', () => {
    it('se niega a correr con NODE_ENV=production', () => {
      expect(() => verificarEntorno({ NODE_ENV: 'production', DATABASE_URL: URL_LOCAL })).toThrow(/producci[oó]n/i);
      expect(() => verificarEntorno({ NODE_ENV: ' Production ', DATABASE_URL: URL_LOCAL })).toThrow(/producci[oó]n/i);
    });

    it('exige DATABASE_URL y que sea una URL válida', () => {
      expect(() => verificarEntorno({})).toThrow(/DATABASE_URL/);
      expect(() => verificarEntorno({ DATABASE_URL: '   ' })).toThrow(/DATABASE_URL/);
      expect(() => verificarEntorno({ DATABASE_URL: 'no es una url' })).toThrow(/DATABASE_URL/);
    });

    it('en desarrollo o en pruebas devuelve el destino', () => {
      expect(verificarEntorno({ NODE_ENV: 'development', DATABASE_URL: URL_LOCAL })).toEqual({
        host: 'localhost',
        puerto: '55436',
        base: 'gafer_test',
      });
      expect(leerDestino('postgres://u:p@db.interno.example.com/gafer').puerto).toBe('5432');
    });
  });

  describe('destino', () => {
    it('describe host, puerto y base sin mostrar usuario ni clave', () => {
      const texto = describirDestino(leerDestino(URL_LOCAL));
      expect(texto).toContain('localhost:55436/gafer_test');
      expect(texto).not.toContain('gafer:');
      expect(texto).not.toContain('secreto-del-test');
    });

    it('localhost y 127.0.0.1 no piden confirmación', () => {
      expect(() => exigirDestinoConfirmado(leerDestino(URL_LOCAL), leerOpcionesSeed([]))).not.toThrow();
      expect(() => exigirDestinoConfirmado(leerDestino('postgresql://u:p@127.0.0.1:5432/gafer'), leerOpcionesSeed([]))).not.toThrow();
    });

    it('un host remoto exige --confirmar-destino-remoto', () => {
      const remoto = leerDestino('postgresql://u:p@db.interno.example.com:5432/gafer');
      expect(() => exigirDestinoConfirmado(remoto, leerOpcionesSeed([]))).toThrow(/--confirmar-destino-remoto/);
      expect(() => exigirDestinoConfirmado(remoto, leerOpcionesSeed(['--confirmar-destino-remoto']))).not.toThrow();
    });
  });
});
