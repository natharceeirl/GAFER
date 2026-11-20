import { describe, it, expect } from 'vitest';
import {
  comprimirFoto,
  validarTamanoC15,
  calcularSha256,
  calcularTamanoBytesBase64,
  generarRutaFoto,
  generarRutaFirma,
  MAX_TAMANO_FOTO_BYTES,
} from './fotos-compresion';

describe('Compresión y Procesamiento de Fotos (§13.1, Decisión C15)', () => {
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

  describe('calcularSha256', () => {
    it('genera un hash SHA-256 hexadecimal de 64 caracteres determinista', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const hash1 = await calcularSha256(data);
      const hash2 = await calcularSha256(data);

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('comprimirFoto (Decisión C15)', () => {
    it('mantiene intacta una foto que ya pesa menos de 1 MB', async () => {
      const tamanoPequeno = 250 * 1024; // 250 KB
      const bytesOriginales = new Uint8Array(tamanoPequeno);
      for (let i = 0; i < tamanoPequeno; i++) bytesOriginales[i] = (i % 256);

      const resultado = await comprimirFoto({ buffer: bytesOriginales });

      expect(resultado.fueComprimida).toBe(false);
      expect(resultado.tamanoBytes).toBe(tamanoPequeno);
      expect(resultado.tamanoBytes).toBeLessThanOrEqual(MAX_TAMANO_FOTO_BYTES);
      expect(resultado.sha256).toBeDefined();
    });

    it('comprime automáticamente una foto pesada (> 3 MB) a un tamaño <= 1 MB', async () => {
      const tamanoPesado = 3.5 * 1024 * 1024; // 3.5 MB
      const bytesPesados = new Uint8Array(tamanoPesado);
      for (let i = 0; i < tamanoPesado; i++) bytesPesados[i] = (i % 256);

      const resultado = await comprimirFoto({ buffer: bytesPesados });

      expect(resultado.fueComprimida).toBe(true);
      expect(resultado.tamanoBytes).toBeLessThanOrEqual(MAX_TAMANO_FOTO_BYTES);
      expect(resultado.tamanoBytes).toBeGreaterThan(0);
      expect(validarTamanoC15(resultado.tamanoBytes)).toBe(true);
      expect(resultado.sha256).toHaveLength(64);
    });

    it('procesa y comprime fotos provistas como Base64', async () => {
      const tamano1MBYMedio = 1.5 * 1024 * 1024;
      const buffer = Buffer.alloc(tamano1MBYMedio, 42);
      const base64Data = `data:image/jpeg;base64,${buffer.toString('base64')}`;

      const resultado = await comprimirFoto({ base64: base64Data, mimeType: 'image/jpeg' });

      expect(resultado.fueComprimida).toBe(true);
      expect(resultado.tamanoBytes).toBeLessThanOrEqual(MAX_TAMANO_FOTO_BYTES);
      expect(resultado.mimeType).toBe('image/jpeg');
    });

    it('falla si no se provee buffer ni base64', async () => {
      await expect(comprimirFoto({})).rejects.toThrow('Debe proporcionar buffer o base64');
    });
  });

  describe('generarRutaFoto y generarRutaFirma (§5.3)', () => {
    it('genera rutas relativas de acuerdo a la jerarquía canónica de inspecciones', () => {
      const inspId = '12345678-1234-1234-1234-123456789abc';
      const fileId = 'abcdef01-abcd-abcd-abcd-abcdef012345';

      const rutaFoto = generarRutaFoto(inspId, fileId);
      expect(rutaFoto).toBe(`inspections/INS_${inspId}/photos/PH_${fileId}.jpg`);

      const rutaFirma = generarRutaFirma(inspId, fileId);
      expect(rutaFirma).toBe(`inspections/INS_${inspId}/signatures/SIG_${fileId}.png`);
    });
  });
});
