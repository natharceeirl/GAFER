/**
 * operaciones-mis-servicios.e2e-spec.ts
 * Pruebas E2E contra PostgreSQL real para GAF-104 (F2, F3, F4, F5, F7):
 * - KyselyInspeccionRepository.listarPorTecnico / listarTodas (TIME -> HH:mm, filtro CERRADO, JSONB tecnicos_participantes, JOIN cliente/sede/servicio)
 * - GET /operaciones/inspecciones/mis-servicios validado contra ResumenServicioTecnicoSchema
 * - Autorización en GET /operaciones/inspecciones?servicioId=<uuid> para TECNICO_OPERADOR
 * - POST /operaciones/inspecciones/:id/solicitar-correccion y persistencia en inspecciones_auditoria y auditoria_eventos
 */
import { randomUUID } from 'crypto';
import { ResumenServicioTecnicoSchema } from '@gafer/contracts';
import { createTestApp, TestApp } from '../support/app';
import { autorizacion } from '../support/auth';
import { resetDb } from '../support/db';
import { Api, api, crearEscenario } from '../support/fixtures';
import {
  INSPECCION_REPOSITORY,
  InspeccionRepository,
} from '../../src/operaciones/domain/ports/inspeccion.repository';

describe('GAF-104: Mis servicios cerrados, autorización y solicitud de corrección (PostgreSQL E2E)', () => {
  let t: TestApp;
  let http: Api;
  let inspeccionRepo: InspeccionRepository;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t.baseUrl);
    inspeccionRepo = t.app.get<InspeccionRepository>(INSPECCION_REPOSITORY);
  });

  beforeEach(async () => {
    await resetDb(t.db);
  });

  afterAll(async () => {
    await t.close();
  });

  it('listarPorTecnico y GET /mis-servicios devuelven solo cerrados donde participó, con hora HH:mm y metadatos JOIN válidos', async () => {
    const esc = await crearEscenario(http);
    const sesionTecnico = autorizacion('TECNICO_OPERADOR', { id: esc.tecnicoId, usuario: 'JPEREZ' });

    // 1. Inspección cerrada donde el técnico SÍ participa, con hora_inicio y hora_fin TIME reales
    const inspCerradaId = randomUUID();
    await t.db.query(
      `INSERT INTO inspecciones (id, servicio_id, codigo_inspeccion, estado, version_sync, fecha_ejecucion, hora_inicio, hora_fin, tecnicos_participantes, snapshot_catalogos)
       VALUES ($1, $2, 'GAFER-2026-CERRADA-1', 'CERRADO', 2, '2026-11-03', '08:30:00', '11:15:45', $3::jsonb, $4::jsonb)`,
      [
        inspCerradaId,
        esc.servicioId,
        JSON.stringify([{ id: esc.tecnicoId, nombre: 'Juan Perez Gomez' }]),
        JSON.stringify({ insumos: [{ nombreHistorico: 'Cipermetrina 25% CE', lote: 'L-1' }] }),
      ],
    );

    // 2. Inspección BORRADOR donde participa (NO debe listarse en mis-servicios)
    await t.db.query(
      `INSERT INTO inspecciones (id, servicio_id, codigo_inspeccion, estado, version_sync, fecha_ejecucion, tecnicos_participantes, snapshot_catalogos)
       VALUES ($1, $2, 'GAFER-2026-BORRADOR-1', 'BORRADOR', 1, '2026-11-03', $3::jsonb, '{}'::jsonb)`,
      [
        randomUUID(),
        esc.servicioId,
        JSON.stringify([{ id: esc.tecnicoId, nombre: 'Juan Perez Gomez' }]),
      ],
    );

    // 3. Inspección CERRADA donde el ID aparece solo en snapshot_catalogos, NO en tecnicos_participantes
    await t.db.query(
      `INSERT INTO inspecciones (id, servicio_id, codigo_inspeccion, estado, version_sync, fecha_ejecucion, tecnicos_participantes, snapshot_catalogos)
       VALUES ($1, $2, 'GAFER-2026-SOLO-SNAPSHOT', 'CERRADO', 2, '2026-11-03', '[]'::jsonb, $3::jsonb)`,
      [
        randomUUID(),
        esc.servicioId,
        JSON.stringify({ nota: `referencia ${esc.tecnicoId}` }),
      ],
    );

    // Verificar repositorio directamente
    const delRepo = await inspeccionRepo.listarPorTecnico(esc.tecnicoId);
    expect(delRepo).toHaveLength(1);
    expect(delRepo[0].id).toBe(inspCerradaId);
    expect(delRepo[0].horaInicio).toBe('08:30');
    expect(delRepo[0].horaFin).toBe('11:15');
    expect(delRepo[0].clienteRazonSocial).toBeTruthy();
    expect(delRepo[0].sedeNombre).toBeTruthy();
    expect(delRepo[0].servicioTipo).toBeTruthy();

    // Verificar endpoint HTTP y validar contrato Zod real
    const res = await http.get('/operaciones/inspecciones/mis-servicios', sesionTecnico);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const parsed = ResumenServicioTecnicoSchema.parse(res.body[0]);
    expect(parsed.id).toBe(inspCerradaId);
    expect(parsed.horaInicio).toBe('08:30');
    expect(parsed.horaFin).toBe('11:15');
    expect(parsed.clienteRazonSocial).toBe(delRepo[0].clienteRazonSocial);
    expect(parsed.sedeNombre).toBe(delRepo[0].sedeNombre);
    expect(parsed.servicioTipo).toBe(delRepo[0].servicioTipo);
  });

  it('GET /operaciones/inspecciones?servicioId=<uuid> rechaza con 403 a un técnico no participante y permite al participante (F4)', async () => {
    const esc = await crearEscenario(http);
    const otroTecnicoId = randomUUID();
    const inspId = randomUUID();

    await t.db.query(
      `INSERT INTO inspecciones (id, servicio_id, codigo_inspeccion, estado, version_sync, fecha_ejecucion, tecnicos_participantes, snapshot_catalogos)
       VALUES ($1, $2, 'GAFER-2026-AUTH-1', 'CERRADO', 2, '2026-11-03', $3::jsonb, '{}'::jsonb)`,
      [inspId, esc.servicioId, JSON.stringify([{ id: esc.tecnicoId, nombre: 'Juan Perez Gomez' }])],
    );

    const ajeno = await http.get(
      `/operaciones/inspecciones?servicioId=${esc.servicioId}`,
      autorizacion('TECNICO_OPERADOR', { id: otroTecnicoId, usuario: 'OTRO' }),
    );
    expect(ajeno.status).toBe(403);

    const propio = await http.get(
      `/operaciones/inspecciones?servicioId=${esc.servicioId}`,
      autorizacion('TECNICO_OPERADOR', { id: esc.tecnicoId, usuario: 'JPEREZ' }),
    );
    expect(propio.status).toBe(200);
    expect(propio.body.id).toBe(inspId);
  });

  it('POST /operaciones/inspecciones/:id/solicitar-correccion persiste exactamente un registro SOLICITUD_CORRECCION en inspecciones_auditoria y evento en auditoria_eventos', async () => {
    const esc = await crearEscenario(http);
    const sesionTecnico = autorizacion('TECNICO_OPERADOR', { id: esc.tecnicoId, usuario: 'JPEREZ' });

    const inspId = randomUUID();
    await t.db.query(
      `INSERT INTO inspecciones (id, servicio_id, codigo_inspeccion, estado, version_sync, fecha_ejecucion, tecnicos_participantes, snapshot_catalogos)
       VALUES ($1, $2, 'GAFER-2026-CORR-1', 'CERRADO', 2, '2026-11-03', $3::jsonb, '{}'::jsonb)`,
      [inspId, esc.servicioId, JSON.stringify([{ id: esc.tecnicoId, nombre: 'Juan Perez Gomez' }])],
    );

    const motivo = 'Se ingresó erróneamente la estación 12 en lugar de la 14';
    const res = await http.post(
      `/operaciones/inspecciones/${inspId}/solicitar-correccion`,
      { motivo },
      sesionTecnico,
    );
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);

    const { rows: audInsp } = await t.db.query(
      'SELECT inspeccion_id, actor_id, accion, payload_nuevo FROM inspecciones_auditoria WHERE inspeccion_id = $1',
      [inspId],
    );
    expect(audInsp).toHaveLength(1);
    expect(audInsp[0]).toMatchObject({
      inspeccion_id: inspId,
      actor_id: esc.tecnicoId,
      accion: 'SOLICITUD_CORRECCION',
    });
    expect(audInsp[0].payload_nuevo.motivo).toBe(motivo);

    const { rows: audEventos } = await t.db.query(
      "SELECT modulo, accion, entidad_id FROM auditoria_eventos WHERE entidad_id = $1 AND accion = 'SOLICITAR_CORRECCION'",
      [inspId],
    );
    expect(audEventos).toHaveLength(1);
  });
});
