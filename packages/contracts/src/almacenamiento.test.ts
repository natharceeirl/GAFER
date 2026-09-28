import { describe, expect, it } from 'vitest';
import { GenerarDownloadUrlSchema, GenerarUploadUrlSchema } from './almacenamiento';
import { esperarFallaEn } from './pruebas';

const key = 'insumos/fichas/ficha-cipermetrina.pdf';

describe('GenerarUploadUrlSchema', () => {
  it('acepta la clave de destino, con o sin tipo de contenido', () => {
    expect(GenerarUploadUrlSchema.safeParse({ key }).success).toBe(true);
    expect(GenerarUploadUrlSchema.safeParse({ key, contentType: 'application/pdf' }).success).toBe(true);
  });
  it('rechaza una clave ausente o vacía', () => {
    esperarFallaEn(GenerarUploadUrlSchema, {}, 'key');
    esperarFallaEn(GenerarUploadUrlSchema, { key: '' }, 'key');
  });
});

describe('GenerarDownloadUrlSchema', () => {
  it('acepta la clave del archivo', () => expect(GenerarDownloadUrlSchema.safeParse({ key }).success).toBe(true));
  it('rechaza una clave vacía', () => esperarFallaEn(GenerarDownloadUrlSchema, { key: '' }, 'key'));
});
