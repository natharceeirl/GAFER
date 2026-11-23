import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FotoEvidenciaDrt } from '@gafer/contracts';

const { testRuntime, rnTools } = await vi.hoisted(async () => {
  const { createReactTestRuntime, createReactNativeMock } = await import(
    '../../../test-utils/rn-test-harness'
  );
  return {
    testRuntime: createReactTestRuntime(),
    rnTools: createReactNativeMock(),
  };
});

vi.mock('react', () => testRuntime.reactMock);
vi.mock('react-native', () => rnTools.rnMock);

import { inicializarBaseDeDatos, cerrarBaseDeDatos } from '../../../shared/db/sqlite';
import { MemoryFilesystemAdapter } from '../../../shared/storage/filesystem';
import { ArchivosLocalRepository } from '../model/archivos-local.repository';
import { MAX_TAMANO_FOTO_BYTES } from '../model/fotos-compresion';
import { CapturadorFotosPort, ExpoImagePickerCapturador } from '../model/captura-fotos';
import { GaleriaEvidenciasFotos } from './GaleriaEvidenciasFotos';

const SERVICIO_UUID = 'd1111111-1111-4000-8000-000000000001';
const TECNICO_UUID = '33333333-3333-4000-8000-000000000001';

describe('GaleriaEvidenciasFotos (F2, F9, F10)', () => {
  let fs: MemoryFilesystemAdapter;
  let archivosRepo: ArchivosLocalRepository;

  beforeEach(async () => {
    rnTools.reset();
    await cerrarBaseDeDatos();
    const db = await inicializarBaseDeDatos();
    fs = new MemoryFilesystemAdapter();
    archivosRepo = new ArchivosLocalRepository(db, fs);
  });

  afterEach(async () => {
    testRuntime.unmount();
    await cerrarBaseDeDatos();
  });

  it('captura fotografías reales desde cámara y galería vía CapturadorFotosPort sin generar buffers sintéticos (F2)', async () => {
    const jpegReal = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0xff, 0xd9]);
    const capturador: CapturadorFotosPort = {
      capturarDesdeCamara: vi.fn(async () => ({
        uri: 'file:///camera/evidencia_campo.jpg',
        nombre: 'evidencia_campo.jpg',
        mimeType: 'image/jpeg',
        buffer: jpegReal,
      })),
      seleccionarDeGaleria: vi.fn(async () => null), // Usuario cancela galería
    };

    const onFotosChange = vi.fn<(fotos: FotoEvidenciaDrt[]) => void>();

    testRuntime.render(GaleriaEvidenciasFotos, {
      inspectionId: SERVICIO_UUID,
      fotos: [],
      onFotosChange,
      actorId: TECNICO_UUID,
      archivosRepo,
      capturador,
    });

    await (testRuntime.getByTestId('boton-capturar-camara').props.onPress as () => Promise<void>)();

    expect(capturador.capturarDesdeCamara).toHaveBeenCalledTimes(1);
    expect(onFotosChange).toHaveBeenCalledTimes(1);
    const fotosAgregadas = onFotosChange.mock.calls[0][0];
    expect(fotosAgregadas).toHaveLength(1);
    expect(fotosAgregadas[0].nombre).toBe('evidencia_campo.jpg');
    expect(fotosAgregadas[0].tamanoBytes).toBe(jpegReal.byteLength);
    expect(await fs.existe(fotosAgregadas[0].rutaLocalRelativa)).toBe(true);

    // Cancelar en galería no agrega fotos ni muestra alertas de error
    await (testRuntime.getByTestId('boton-seleccionar-galeria').props.onPress as () => Promise<void>)();
    expect(capturador.seleccionarDeGaleria).toHaveBeenCalledTimes(1);
    expect(onFotosChange).toHaveBeenCalledTimes(1);
    expect(rnTools.alertMock).not.toHaveBeenCalled();
  });

  it('muestra badge "C15 VÁLIDO" solo cuando tamanoBytes <= 1 MB y "EXCEDE C15" cuando supera 1 MB (F9)', () => {
    const fotoValida: FotoEvidenciaDrt = {
      id: '11111111-1111-4000-8000-000000000001',
      nombre: 'foto_ok.jpg',
      rutaLocalRelativa: 'inspections/INS_1/photos/PH_1.jpg',
      tamanoBytes: 512 * 1024,
      sha256: 'a'.repeat(64),
      mimeType: 'image/jpeg',
      capturadaEn: '2026-11-03T10:00:00Z',
    };
    const fotoExcedida: FotoEvidenciaDrt = {
      id: '11111111-1111-4000-8000-000000000002',
      nombre: 'foto_pesada.jpg',
      rutaLocalRelativa: 'inspections/INS_1/photos/PH_2.jpg',
      tamanoBytes: MAX_TAMANO_FOTO_BYTES + 200_000,
      sha256: 'b'.repeat(64),
      mimeType: 'image/jpeg',
      capturadaEn: '2026-11-03T10:01:00Z',
    };

    testRuntime.render(GaleriaEvidenciasFotos, {
      inspectionId: SERVICIO_UUID,
      fotos: [fotoValida, fotoExcedida],
      onFotosChange: vi.fn(),
      archivosRepo,
    });

    const badgeValido = testRuntime.getByTestId(`badge-c15-${fotoValida.id}`);
    expect(testRuntime.getTextContent(badgeValido)).toBe('C15 VÁLIDO');

    const badgeExcedido = testRuntime.getByTestId(`badge-c15-${fotoExcedida.id}`);
    expect(testRuntime.getTextContent(badgeExcedido)).toBe('EXCEDE C15');
    expect(testRuntime.getTextContent(badgeExcedido)).not.toContain('C15 VÁLIDO');
  });

  it('ExpoImagePickerCapturador solicita permisos y delega a expo-image-picker (F2)', async () => {
    const pickerFake = {
      requestCameraPermissionsAsync: vi.fn(async () => ({ granted: true })),
      requestMediaLibraryPermissionsAsync: vi.fn(async () => ({ granted: false })),
      launchCameraAsync: vi.fn(async () => ({
        canceled: false,
        assets: [
          {
            uri: 'file:///camera/IMG_001.jpg',
            fileName: 'IMG_001.jpg',
            mimeType: 'image/jpeg',
            fileSize: 320_000,
          },
        ],
      })),
      launchImageLibraryAsync: vi.fn(async () => ({ canceled: true, assets: null })),
      getPendingResultAsync: vi.fn(async () => null),
    };

    const capturador = new ExpoImagePickerCapturador(pickerFake);

    const foto = await capturador.capturarDesdeCamara();
    expect(pickerFake.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(pickerFake.launchCameraAsync).toHaveBeenCalledTimes(1);
    expect(foto?.uri).toBe('file:///camera/IMG_001.jpg');
    expect(foto?.nombre).toBe('IMG_001.jpg');

    await expect(capturador.seleccionarDeGaleria()).rejects.toThrow(/permiso de galería/i);
  });
});
