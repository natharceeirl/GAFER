/**
 * GAFER Mobile — E2E Test: Captura de Fotos con Compresión (C15) y Firma del Responsable en Pantalla (GAF-36)
 *
 * Verifica los criterios de aceptación de GAF-36:
 * 1. Fotos comprimidas a un máximo de 1 MB mediante recompresión real (Decisión C15 / §13.1).
 * 2. Firma del responsable capturada en pantalla (SVG Base64 inmutable y persistida en files_local + outbox).
 * 3. Opción explícita "responsable no estuvo disponible" sin bloquear la finalización del servicio.
 * 4. Almacenamiento durable en filesystem relativo, SQLite files_local y sync_outbox (§5.2, §5.3, §13.1.1).
 * 5. Cierre y encolado en Outbox sin conexión a red ("Durable before visible").
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ActaServicioDrt,
  ActaServicioDrtSchema,
  FotoEvidenciaDrtSchema,
  OperacionSyncSchema,
  PayloadArchivoSyncSchema,
} from '@gafer/contracts';
import {
  inicializarBaseDeDatos,
  cerrarBaseDeDatos,
  SqliteDatabasePort,
} from '../../../shared/db/sqlite';
import { MemoryFilesystemAdapter } from '../../../shared/storage/filesystem';
import { OutboxQueue } from '../../../shared/db/outbox';
import { ArchivosLocalRepository } from './archivos-local.repository';
import { BorradorRepository } from './borrador-repository';
import {
  comprimirFoto,
  configurarCompresorImagen,
  CompresorImagenPort,
  MAX_TAMANO_FOTO_BYTES,
  generarRutaFoto,
  generarRutaFirma,
} from './fotos-compresion';
import { generarSvgFirmaBase64 } from './firma-svg';

function crearCompresorE2e(): CompresorImagenPort {
  return {
    async recomprimir(sol) {
      const tamano = Math.max(64 * 1024, Math.floor(800 * 1024 * sol.calidad));
      const salida = new Uint8Array(tamano);
      salida[0] = 0xff;
      salida[1] = 0xd8;
      salida[2] = 0xff;
      salida[3] = 0xe0;
      salida[salida.length - 2] = 0xff;
      salida[salida.length - 1] = 0xd9;
      return { bytes: salida, mimeType: 'image/jpeg' };
    },
  };
}

describe('E2E: Fotos con Compresión C15 y Firma en Pantalla (GAF-36)', () => {
  let db: SqliteDatabasePort;
  let fs: MemoryFilesystemAdapter;
  let archivosRepo: ArchivosLocalRepository;
  let borradorRepo: BorradorRepository;

  const servicioId = 'b8214fa3-54cd-4e8c-8c76-90b9f143a219';
  const tecnicoId = '33333333-3333-4000-8000-000000000001';

  beforeEach(async () => {
    await cerrarBaseDeDatos();
    db = await inicializarBaseDeDatos();
    fs = new MemoryFilesystemAdapter();
    archivosRepo = new ArchivosLocalRepository(db, fs);
    borradorRepo = new BorradorRepository(db);
    configurarCompresorImagen(crearCompresorE2e());
  });

  afterEach(async () => {
    configurarCompresorImagen(null);
    await cerrarBaseDeDatos();
  });

  describe('1. Compresión y Validación Estricta de Fotos (Decisión C15: máx 1 MB)', () => {
    it('comprime automáticamente fotos mayores a 1 MB garantizando <= 1,048,576 bytes con JPEG válido', async () => {
      const entradaBytes = new Uint8Array(3.2 * 1024 * 1024).fill(0xab);

      const resultado = await comprimirFoto(entradaBytes, {
        calidadInicial: 0.85,
        maxBytes: MAX_TAMANO_FOTO_BYTES,
      });

      expect(resultado.fueComprimida).toBe(true);
      expect(resultado.tamanoBytes).toBeLessThanOrEqual(MAX_TAMANO_FOTO_BYTES);
      expect(resultado.buffer.byteLength).toBe(resultado.tamanoBytes);
      expect(Array.from(resultado.buffer.slice(0, 2))).toEqual([0xff, 0xd8]);
      expect(Array.from(resultado.buffer.slice(-2))).toEqual([0xff, 0xd9]);
      expect(resultado.sha256).toMatch(/^[0-9a-f]{64}$/);
    });

    it('FotoEvidenciaDrtSchema aprueba fotos de <= 1 MB y rechaza fotos > 1 MB con mensaje C15', () => {
      const fotoValida = {
        id: '11111111-2222-3333-4444-555555555555',
        nombre: 'cebadero-01-evidencia.jpg',
        rutaLocalRelativa: 'inspections/INS_123/photos/PH_01.jpg',
        tamanoBytes: 850 * 1024,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        mimeType: 'image/jpeg',
        capturadaEn: '2026-11-03T10:15:00Z',
      };

      expect(FotoEvidenciaDrtSchema.safeParse(fotoValida).success).toBe(true);

      const parseInvalido = FotoEvidenciaDrtSchema.safeParse({
        ...fotoValida,
        tamanoBytes: 1.5 * 1024 * 1024,
      });
      expect(parseInvalido.success).toBe(false);
      if (!parseInvalido.success) {
        const errorC15 = parseInvalido.error.errors.find((e) => e.message.includes('C15'));
        expect(errorC15?.message).toContain('La foto no debe superar 1 MB (Decisión C15)');
      }
    });

    it('genera rutas canónicas de archivos según especificación §5.3', () => {
      expect(generarRutaFoto('srv-100', 'foto-999')).toBe(
        'inspections/INS_srv-100/photos/PH_foto-999.jpg',
      );
      expect(generarRutaFirma('srv-100', 'sig-888')).toBe(
        'inspections/INS_srv-100/signatures/SIG_sig-888.svg',
      );
      expect(generarRutaFirma('srv-100', 'sig-888', 'image/png')).toBe(
        'inspections/INS_srv-100/signatures/SIG_sig-888.png',
      );
    });
  });

  describe('2. Almacenamiento Offline en Filesystem y SQLite files_local (§5.2, §5.3)', () => {
    it('guarda fotos en filesystem con ruta relativa e indexa en SQLite y sync_outbox con estado PENDING', async () => {
      const buffer = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0xff, 0xd9]);

      const archivoGuardado = await archivosRepo.guardarFoto({
        inspectionId: servicioId,
        buffer,
        nombre: 'estacion-03-consumo.jpg',
        descripcion: 'Cebo consumido al 50%',
        actorId: tecnicoId,
      });

      expect(archivoGuardado.file_id).toBeDefined();
      expect(archivoGuardado.inspection_id).toBe(servicioId);
      expect(archivoGuardado.file_type).toBe('PHOTO');
      expect(archivoGuardado.upload_status).toBe('PENDING');
      expect(archivoGuardado.size_bytes).toBeLessThanOrEqual(MAX_TAMANO_FOTO_BYTES);

      expect(await fs.existe(archivoGuardado.local_path_relative)).toBe(true);
      const bytesFs = await fs.leerBytes(archivoGuardado.local_path_relative);
      expect(bytesFs.byteLength).toBe(archivoGuardado.size_bytes);

      const filaDb = await archivosRepo.obtenerPorId(archivoGuardado.file_id);
      expect(filaDb).not.toBeNull();
      expect(filaDb?.sha256).toBe(archivoGuardado.sha256);
      expect(filaDb?.upload_status).toBe('PENDING');
    });

    it('guarda firma SVG del cliente en pantalla con flag pinned = 1, extensión .svg y estado PENDING', async () => {
      const firmaSvgBase64 = generarSvgFirmaBase64([
        [
          { x: 15, y: 70 },
          { x: 140, y: 50 },
        ],
      ]);

      const firmaGuardada = await archivosRepo.guardarFirma({
        inspectionId: servicioId,
        firmaBase64: firmaSvgBase64,
        firmanteNombre: 'Ing. Fernando Valdivia',
        firmanteCargo: 'Jefe de Planta',
        actorId: tecnicoId,
      });

      expect(firmaGuardada.file_type).toBe('SIGNATURE');
      expect(firmaGuardada.pinned).toBe(1);
      expect(firmaGuardada.mime_type).toBe('image/svg+xml');
      expect(firmaGuardada.upload_status).toBe('PENDING');
      expect(firmaGuardada.local_path_relative).toMatch(/\/signatures\/SIG_.*\.svg$/);
      expect(await fs.existe(firmaGuardada.local_path_relative)).toBe(true);

      const filaDb = await archivosRepo.obtenerPorId(firmaGuardada.file_id);
      expect(filaDb?.file_type).toBe('SIGNATURE');
      expect(filaDb?.pinned).toBe(1);
    });
  });

  describe('3. Opción "Responsable no estuvo disponible" sin bloquear el servicio', () => {
    it('permite finalizar el servicio sin firma si responsableNoDisponible es true', async () => {
      const actaSinFirmaDisponible: ActaServicioDrt = {
        servicioId,
        clienteRazonSocial: 'ALICORP S.A.A.',
        sedeDireccion: 'Av. Argentina 4793, Callao',
        fecha: '2026-11-03',
        areaTratadaM2: 1200,
        horaInicio: '09:00',
        horaTermino: '11:45',
        actividad: 'MONITOREO',
        tipoCebo: 'BLOQUE_10G',
        cebosInstalados: 30,
        cebosConsumidos: 5,
        cebosRepuestos: 5,
        tipoTrampa: 'MECANICA',
        trampasInstaladas: 10,
        trampasActivadas: 1,
        roedoresDetectados: ['R_NORVEGICUS'],
        resultadosRecomendaciones: 'Inspección de rutina perimétrica.',
        observacionesCliente: 'No hubo personal para recepción al momento de concluir.',
        firmas: {
          personalResponsableNombre: 'Manuel Prado',
          personalResponsableCargo: 'Técnico Especialista',
          clienteConformidadNombre: 'Responsable No Disponible',
          clienteConformidadCargo: 'N/A',
          fecha: '2026-11-03',
          responsableNoDisponible: true,
          motivoNoDisponible: 'Supervisor de turno no se encontraba en sede durante el cierre',
        },
        planillaEstaciones: [
          {
            numero: 1,
            tipoCebo: 'BLOQUE_10G',
            cantidadGramos: 20,
            lote: 'L-2026-01',
            vencimiento: '2026-12-31',
            estadoFisico: 'BUENAS_CONDICIONES',
            estado: 'SIN_ACTIVIDAD',
            huboConsumo: false,
            consumoGramos: 0,
            repuestoGramos: 0,
          },
        ],
        fotos: [],
      };

      expect(ActaServicioDrtSchema.safeParse(actaSinFirmaDisponible).success).toBe(true);

      await borradorRepo.guardarDrt(actaSinFirmaDisponible, { usuarioId: tecnicoId });
      const borradorAntes = await borradorRepo.obtenerPorServicioId(servicioId, tecnicoId);
      expect(borradorAntes).not.toBeNull();
      expect(borradorAntes?.datosDrt?.firmas.responsableNoDisponible).toBe(true);
      expect(borradorAntes?.datosDrt?.firmas.motivoNoDisponible).toContain('Supervisor de turno');

      const { operationId } = await borradorRepo.finalizarYEncolarDrt(
        actaSinFirmaDisponible,
        tecnicoId,
      );
      expect(operationId).toBeDefined();

      const outbox = new OutboxQueue(db);
      await outbox.inicializar();
      const pendientes = outbox.obtenerPendientes();
      const opEncolada = pendientes.find((p) => p.operacion.operationId === operationId);
      expect(opEncolada).toBeDefined();
      expect(opEncolada?.priority).toBe('HIGH');
      expect((opEncolada?.operacion.payload as any)?.firmas?.responsableNoDisponible).toBe(true);
    });
  });

  describe('4. Flujo Integral E2E: Fotos + Firma + Planilla + Outbox sin Conexión', () => {
    it('ejecuta el ciclo de vida completo offline con fotos comprimidas, firma SVG en files_local y encolado outbox', async () => {
      const foto1Bytes = new Uint8Array(1.8 * 1024 * 1024).fill(0x11);
      const foto2Bytes = new Uint8Array(0.6 * 1024 * 1024).fill(0x22);

      const foto1Guardada = await archivosRepo.guardarFoto({
        inspectionId: servicioId,
        buffer: foto1Bytes,
        nombre: 'evidencia_roedor_estacion_2.jpg',
        descripcion: 'Estación 2 con signos de roeduras',
        actorId: tecnicoId,
      });

      const foto2Guardada = await archivosRepo.guardarFoto({
        inspectionId: servicioId,
        buffer: foto2Bytes,
        nombre: 'panoramica_perimetro.jpg',
        descripcion: 'Vista perimétrica norte',
        actorId: tecnicoId,
      });

      const firmaSvgBase64 = generarSvgFirmaBase64([
        [
          { x: 25, y: 80 },
          { x: 180, y: 40 },
        ],
      ]);
      const firmaGuardada = await archivosRepo.guardarFirma({
        inspectionId: servicioId,
        firmaBase64: firmaSvgBase64,
        firmanteNombre: 'Carlos Bustamante',
        firmanteCargo: 'Supervisor de Operaciones',
        actorId: tecnicoId,
      });

      const actaCompleta: ActaServicioDrt = {
        servicioId,
        clienteRazonSocial: 'NESTLÉ PERÚ S.A.',
        sedeDireccion: 'Fábrica D’Onofrio, Lima',
        fecha: '2026-11-03',
        areaTratadaM2: 2500,
        horaInicio: '08:00',
        horaTermino: '12:00',
        actividad: 'MONITOREO',
        tipoCebo: 'BLOQUE_10G',
        cebosInstalados: 50,
        cebosConsumidos: 10,
        cebosRepuestos: 10,
        tipoTrampa: 'MECANICA',
        trampasInstaladas: 20,
        trampasActivadas: 3,
        roedoresDetectados: ['R_NORVEGICUS', 'MUS_MUSCULUS'],
        resultadosRecomendaciones: 'Cebaderos exteriores inspeccionados y repuestos.',
        observacionesCliente: 'Conforme con el servicio.',
        firmas: {
          personalResponsableNombre: 'Juan Carlos Pérez',
          personalResponsableCargo: 'Técnico Especialista',
          clienteConformidadNombre: 'Carlos Bustamante',
          clienteConformidadCargo: 'Supervisor de Operaciones',
          fecha: '2026-11-03',
          responsableNoDisponible: false,
          firmaArchivoId: firmaGuardada.file_id,
          firmaRutaLocalRelativa: firmaGuardada.local_path_relative,
        },
        planillaEstaciones: [
          {
            numero: 1,
            tipoCebo: 'BLOQUE_10G',
            cantidadGramos: 20,
            lote: 'L-2026-01',
            vencimiento: '2026-12-31',
            estadoFisico: 'BUENAS_CONDICIONES',
            estado: 'SIN_ACTIVIDAD',
            huboConsumo: false,
            consumoGramos: 0,
            repuestoGramos: 0,
          },
          {
            numero: 2,
            tipoCebo: 'BLOQUE_10G',
            cantidadGramos: 20,
            lote: 'L-2026-01',
            vencimiento: '2026-12-31',
            estadoFisico: 'BUENAS_CONDICIONES',
            estado: 'CON_CONSUMO',
            huboConsumo: true,
            porcentajeConsumo: 50,
            consumoGramos: 10,
            repuestoGramos: 10,
          },
        ],
        fotos: [
          {
            id: foto1Guardada.file_id,
            nombre: 'evidencia_roedor_estacion_2.jpg',
            rutaLocalRelativa: foto1Guardada.local_path_relative,
            tamanoBytes: foto1Guardada.size_bytes,
            sha256: foto1Guardada.sha256,
            mimeType: foto1Guardada.mime_type,
            capturadaEn: foto1Guardada.captured_at,
            descripcion: 'Estación 2 con signos de roeduras',
          },
          {
            id: foto2Guardada.file_id,
            nombre: 'panoramica_perimetro.jpg',
            rutaLocalRelativa: foto2Guardada.local_path_relative,
            tamanoBytes: foto2Guardada.size_bytes,
            sha256: foto2Guardada.sha256,
            mimeType: foto2Guardada.mime_type,
            capturadaEn: foto2Guardada.captured_at,
            descripcion: 'Vista perimétrica norte',
          },
        ],
      };

      expect(() => ActaServicioDrtSchema.parse(actaCompleta)).not.toThrow();

      await borradorRepo.guardarDrt(actaCompleta, { usuarioId: tecnicoId });
      const { operationId } = await borradorRepo.finalizarYEncolarDrt(actaCompleta, tecnicoId);
      expect(operationId).toBeDefined();

      const archivos = await archivosRepo.listarPorInspeccion(servicioId);
      expect(archivos).toHaveLength(3);

      const fotos = archivos.filter((a) => a.file_type === 'PHOTO');
      expect(fotos).toHaveLength(2);
      expect(fotos.every((f) => f.upload_status === 'PENDING')).toBe(true);
      expect(fotos.every((f) => f.size_bytes <= MAX_TAMANO_FOTO_BYTES)).toBe(true);

      const firmas = archivos.filter((a) => a.file_type === 'SIGNATURE');
      expect(firmas).toHaveLength(1);
      expect(firmas[0].upload_status).toBe('PENDING');
      expect(firmas[0].pinned).toBe(1);
      expect(firmas[0].mime_type).toBe('image/svg+xml');

      for (const archivo of archivos) {
        expect(await fs.existe(archivo.local_path_relative)).toBe(true);
      }

      // Verificar outbox: 3 REGISTRO_ARCHIVO + 1 REGISTRO_SERVICIO_DRT, todos válidos
      const outbox = new OutboxQueue(db);
      await outbox.inicializar();
      const pendientes = outbox.obtenerPendientes();
      const opsArchivo = pendientes.filter((p) => p.operacion.tipo === 'REGISTRO_ARCHIVO');
      expect(opsArchivo).toHaveLength(3);
      for (const p of pendientes) {
        expect(OperacionSyncSchema.safeParse(p.operacion).success).toBe(true);
        if (p.operacion.tipo === 'REGISTRO_ARCHIVO') {
          expect(PayloadArchivoSyncSchema.safeParse(p.operacion.payload).success).toBe(true);
        }
      }
    });
  });
});
