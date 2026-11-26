import { esImagenFirma, interpretarFirma } from './firma-imagen';

/** PNG mínimo (1x1) y cabecera JPEG: solo hacen falta los primeros bytes para reconocer el formato. */
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=';
const JPEG_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString('base64');

describe('interpretarFirma (GAF-55)', () => {
  it('un valor vacío o nulo no es una firma', () => {
    expect(interpretarFirma(null)).toBeNull();
    expect(interpretarFirma(undefined)).toBeNull();
    expect(interpretarFirma('')).toBeNull();
    expect(interpretarFirma('   ')).toBeNull();
  });

  it('decodifica una data URL PNG o JPEG a sus bytes', () => {
    const png = interpretarFirma(`data:image/png;base64,${PNG_B64}`);
    expect(png).toEqual({ tipo: 'imagen', bytes: Buffer.from(PNG_B64, 'base64') });
    const jpeg = interpretarFirma(`data:image/jpeg;base64,${JPEG_B64}`);
    expect(jpeg).toEqual({ tipo: 'imagen', bytes: Buffer.from(JPEG_B64, 'base64') });
  });

  it('una data URL cuyos bytes no son PNG/JPEG no es una firma (no se inventa ni se rompe el PDF)', () => {
    expect(interpretarFirma(`data:image/png;base64,${Buffer.from('hola').toString('base64')}`)).toBeNull();
    expect(interpretarFirma('data:image/gif;base64,R0lGODlh')).toBeNull();
    expect(interpretarFirma('data:text/html;base64,PGI+')).toBeNull();
  });

  it('cualquier otro texto se trata como clave de almacenamiento', () => {
    expect(interpretarFirma('firmas/director-tecnico.png')).toEqual({ tipo: 'clave', clave: 'firmas/director-tecnico.png' });
  });
});

describe('esImagenFirma', () => {
  it('reconoce PNG y JPEG por sus primeros bytes', () => {
    expect(esImagenFirma(Buffer.from(PNG_B64, 'base64'))).toBe(true);
    expect(esImagenFirma(Buffer.from(JPEG_B64, 'base64'))).toBe(true);
    expect(esImagenFirma(Buffer.from('%PDF-1.4'))).toBe(false);
    expect(esImagenFirma(Buffer.alloc(0))).toBe(false);
  });
});
