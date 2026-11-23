import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  comprimirFoto,
  validarTamanoC15,
  calcularSha256,
  calcularTamanoBytesBase64,
  generarRutaFoto,
  generarRutaFirma,
  configurarCompresorImagen,
  configurarCalculadorSha256,
  crearCalculadorSha256Expo,
  ExpoImageManipulatorCompresor,
  CompresorImagenPort,
  SolicitudRecompresionImagen,
  MAX_TAMANO_FOTO_BYTES,
} from './fotos-compresion';
import { bytesABase64 } from '../../../shared/utils/base64';

/**
 * Construye un JPEG mínimo con marcadores SOI (FF D8 FF E0) y EOI (FF D9) del tamaño pedido.
 */
function crearJpegSintetico(tamanoBytes: number): Uint8Array {
  const bytes = new Uint8Array(Math.max(16, tamanoBytes));
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xe0;
  bytes[bytes.length - 2] = 0xff;
  bytes[bytes.length - 1] = 0xd9;
  return bytes;
}

describe('Compresión y Procesamiento de Fotos (§13.1, Decisión C15)', () => {
  afterEach(() => {
    configurarCompresorImagen(null);
    configurarCalculadorSha256(null);
  });

  describe('validarTamanoC15', () => {
    it('acepta tamaños de hasta 1 MB (1,048,576 bytes)', () => {
      expect(validarTamanoC15(100)).toBe(true);
      expect(validarTamanoC15(500 * 1024)).toBe(true);
      expect(validarTamanoC15(MAX_TAMANO_FOTO_BYTES)).toBe(true);
    });

    it('rechaza tamaños superiores a 1 MB o inválidos', () => {
      expect(validarTamanoC15(MAX_TAMANO_FOTO_BYTES + 1)).toBe(false);
      expect(validarTamanoC15(2 * 1024 * 1024)).toBe(false);
      expect(validarTamanoC15(0)).toBe(false);
      expect(validarTamanoC15(-50)).toBe(false);
    });
  });

  describe('calcularSha256 (F8)', () => {
    it('calcula el vector criptográfico SHA-256 exacto (no un hash polinomial)', async () => {
      const hashVacio = await calcularSha256(new Uint8Array(0));
      expect(hashVacio).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

      const hashAbc = await calcularSha256('abc');
      expect(hashAbc).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    it('soporta expo-crypto vía crearCalculadorSha256Expo sin depender de crypto.subtle', async () => {
      const digestBytes = new Uint8Array(32).fill(0xab);
      const mockExpoCrypto = {
        CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
        digest: vi.fn(async () => digestBytes.buffer),
      };

      configurarCalculadorSha256(crearCalculadorSha256Expo(mockExpoCrypto));
      const hash = await calcularSha256(new Uint8Array([1, 2, 3]));

      expect(mockExpoCrypto.digest).toHaveBeenCalledWith('SHA-256', new Uint8Array([1, 2, 3]));
      expect(hash).toBe('ab'.repeat(32));
    });

    it('lanza error explícito si no hay proveedor criptográfico en lugar de degradar a hash de 31 bits', async () => {
      const cryptoOriginal = globalThis.crypto;
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
      try {
        await expect(calcularSha256(new Uint8Array([1, 2, 3]))).rejects.toThrow(
          /proveedor criptográfico SHA-256/i,
        );
      } finally {
        Object.defineProperty(globalThis, 'crypto', { value: cryptoOriginal, configurable: true });
      }
    });
  });

  describe('comprimirFoto (F1, F3, Decisión C15)', () => {
    it('mantiene intacta una foto que ya pesa menos de 1 MB sin invocar el compresor', async () => {
      const bytesOriginales = crearJpegSintetico(250 * 1024);
      const recomprimirSpy = vi.fn();
      const compresor: CompresorImagenPort = { recomprimir: recomprimirSpy };

      const resultado = await comprimirFoto({ buffer: bytesOriginales }, { compresor });

      expect(recomprimirSpy).not.toHaveBeenCalled();
      expect(resultado.fueComprimida).toBe(false);
      expect(resultado.tamanoBytes).toBe(bytesOriginales.byteLength);
      expect(resultado.buffer).toEqual(bytesOriginales);
      expect(resultado.sha256).toHaveLength(64);
    });

    it('recomprime iterativamente fotos > 1 MB respetando calidadInicial y conservando cabeceras JPEG válidas (F1)', async () => {
      const llamadas: SolicitudRecompresionImagen[] = [];
      const compresor: CompresorImagenPort = {
        async recomprimir(sol) {
          llamadas.push(sol);
          // Primer intento (calidad 0.85 sin resize) aún supera 1 MB; segundo intento baja a 720 KB
          const tamanoSalida = llamadas.length === 1 ? 1_200_000 : 720 * 1024;
          return {
            bytes: crearJpegSintetico(tamanoSalida),
            mimeType: 'image/jpeg',
            ancho: sol.anchoMaximo ?? 3000,
            alto: 2000,
          };
        },
      };

      const bytesPesados = crearJpegSintetico(3.5 * 1024 * 1024);
      const resultado = await comprimirFoto(
        { buffer: bytesPesados, mimeType: 'image/png' },
        { calidadInicial: 0.85, maxBytes: MAX_TAMANO_FOTO_BYTES, compresor },
      );

      expect(llamadas).toHaveLength(2);
      expect(llamadas[0].calidad).toBe(0.85);
      expect(llamadas[1].calidad).toBeLessThan(0.85);
      expect(llamadas[1].anchoMaximo).toBe(1920);
      expect(resultado.fueComprimida).toBe(true);
      expect(resultado.mimeType).toBe('image/jpeg');
      expect(resultado.tamanoBytes).toBe(720 * 1024);
      // Verificar marcadores SOI/EOI intactos (no submuestreo de bytes crudos)
      expect(Array.from(resultado.buffer.slice(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xe0]);
      expect(Array.from(resultado.buffer.slice(-2))).toEqual([0xff, 0xd9]);
    });

    it('lanza error explícito en vez de corromper bytes si una foto > 1 MB no tiene compresor disponible (F1)', async () => {
      const bytesPesados = crearJpegSintetico(1.5 * 1024 * 1024);
      await expect(comprimirFoto({ buffer: bytesPesados })).rejects.toThrow(
        /compresor de imágenes real/i,
      );
    });

    it('lanza error si incluso tras todos los pasos de recompresión la foto sigue superando 1 MB (F1)', async () => {
      const compresorInsuficiente: CompresorImagenPort = {
        async recomprimir() {
          return { bytes: crearJpegSintetico(MAX_TAMANO_FOTO_BYTES + 100), mimeType: 'image/jpeg' };
        },
      };

      await expect(
        comprimirFoto({ buffer: crearJpegSintetico(2 * 1024 * 1024) }, { compresor: compresorInsuficiente }),
      ).rejects.toThrow(/excede el tamaño máximo permitido de 1 MB/i);
    });

    it('funciona en entorno Hermes sin usar el global Buffer (F3)', async () => {
      const bytesOriginales = crearJpegSintetico(2048);

      // Verificación síncrona con globalThis.Buffer === undefined (simulación estricta de Hermes)
      const bufferOriginal = globalThis.Buffer;
      let base64SinBuffer = '';
      Object.defineProperty(globalThis, 'Buffer', { value: undefined, configurable: true });
      try {
        base64SinBuffer = `data:image/jpeg;base64,${bytesABase64(bytesOriginales)}`;
        expect(calcularTamanoBytesBase64(base64SinBuffer)).toBe(2048);
      } finally {
        Object.defineProperty(globalThis, 'Buffer', { value: bufferOriginal, configurable: true });
      }

      // En el flujo asíncrono de comprimirFoto tampoco se invoca Buffer.from sobre strings/Uint8Array/base64
      const bufferFromSpy = vi.spyOn(Buffer, 'from');
      try {
        const resultado = await comprimirFoto({ base64: base64SinBuffer, mimeType: 'image/jpeg' });
        expect(resultado.tamanoBytes).toBe(2048);
        expect(resultado.buffer).toEqual(bytesOriginales);
        const llamadasBase64OBinario = (bufferFromSpy.mock.calls as readonly unknown[][]).filter(
          (call) =>
            typeof call[0] === 'string' || call[0] instanceof Uint8Array || call[1] === 'base64',
        );
        expect(llamadasBase64OBinario).toHaveLength(0);
      } finally {
        bufferFromSpy.mockRestore();
      }
    });

    it('ExpoImageManipulatorCompresor invoca ImageManipulator.manipulate -> resize -> renderAsync -> saveAsync', async () => {
      const resizeSpy = vi.fn();
      const jpegSalida = crearJpegSintetico(400 * 1024);
      const saveAsyncSpy = vi.fn(async () => ({
        uri: 'file:///cache/recompressed.jpg',
        width: 1280,
        height: 960,
      }));
      const renderAsyncSpy = vi.fn(async () => ({
        width: 1280,
        height: 960,
        saveAsync: saveAsyncSpy,
      }));
      const manipulateSpy = vi.fn(() => {
        const ctx = {
          resize: (s: { width?: number | null }) => {
            resizeSpy(s);
            return ctx;
          },
          renderAsync: renderAsyncSpy,
        };
        return ctx;
      });

      const deleteSpy = vi.fn();
      class FakeFile {
        exists = true;
        constructor(public readonly uri: string) {}
        create() {}
        write() {}
        async bytes() {
          return jpegSalida;
        }
        delete() {
          deleteSpy(this.uri);
        }
      }

      const compresor = new ExpoImageManipulatorCompresor(
        {
          ImageManipulator: { manipulate: manipulateSpy },
          SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
        },
        {
          File: FakeFile as any,
          Paths: { cache: 'file:///cache' },
        },
      );

      const res = await compresor.recomprimir({
        uri: 'file:///camera/photo.jpg',
        mimeType: 'image/jpeg',
        calidad: 0.7,
        anchoMaximo: 1280,
      });

      expect(manipulateSpy).toHaveBeenCalledWith('file:///camera/photo.jpg');
      expect(resizeSpy).toHaveBeenCalledWith({ width: 1280 });
      expect(saveAsyncSpy).toHaveBeenCalledWith({
        compress: 0.7,
        format: 'jpeg',
        base64: false,
      });
      expect(res.bytes).toEqual(jpegSalida);
      expect(res.mimeType).toBe('image/jpeg');
      expect(deleteSpy).toHaveBeenCalledWith('file:///cache/recompressed.jpg');
    });

    it('falla si no se provee uri, buffer ni base64', async () => {
      await expect(comprimirFoto({})).rejects.toThrow('Debe proporcionar uri, buffer o base64');
    });
  });

  describe('generarRutaFoto y generarRutaFirma (§5.3, F5)', () => {
    it('genera rutas relativas coherentes con el formato real de fotos y firmas', () => {
      const inspId = '12345678-1234-1234-1234-123456789abc';
      const fileId = 'abcdef01-abcd-abcd-abcd-abcdef012345';

      expect(generarRutaFoto(inspId, fileId)).toBe(
        `inspections/INS_${inspId}/photos/PH_${fileId}.jpg`,
      );
      expect(generarRutaFirma(inspId, fileId)).toBe(
        `inspections/INS_${inspId}/signatures/SIG_${fileId}.svg`,
      );
      expect(generarRutaFirma(inspId, fileId, 'image/svg+xml')).toBe(
        `inspections/INS_${inspId}/signatures/SIG_${fileId}.svg`,
      );
      expect(generarRutaFirma(inspId, fileId, 'image/png')).toBe(
        `inspections/INS_${inspId}/signatures/SIG_${fileId}.png`,
      );
    });
  });
});
