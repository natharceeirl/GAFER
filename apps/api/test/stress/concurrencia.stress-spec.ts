/**
 * concurrencia.stress-spec.ts
 * Pruebas de estrés y concurrencia de sincronización de campo (T3.2)
 *
 * Simulan varios técnicos enviando datos de campo al mismo tiempo, contra la
 * aplicación real y PostgreSQL real, para revisar dos cosas: que el sistema no
 * pierda datos bajo carga, y que la resolución de colisiones y la idempotencia
 * sigan funcionando cuando las peticiones llegan de verdad al mismo tiempo (no
 * una detrás de otra, que es más fácil de manejar para el servidor).
 *
 * A diferencia de la suite de inmutabilidad, esta suite no forma parte del
 * pipeline de CI: se corre aparte con `pnpm test:stress` porque su objetivo es
 * encontrar y reportar problemas de concurrencia, no certificar cada commit.
 * Por eso algunas pruebas aquí pueden fallar a propósito: documentan un
 * problema real que ya está reportado (ver Issues_QA_Fase1.md).
 *
 * Al final se escribe un reporte en reporte-estres.json y reporte-estres.md
 * con los resultados y algunos tiempos de respuesta.
 *
 * Historial de versiones
 *   v1.0  2026-09-23  ahilacondo  Creación de la suite de estrés (T3.2).
 */
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { createTestApp, TestApp } from '../support/app';
import { resetDb } from '../support/db';
import { Api, api, crearEscenario, Escenario } from '../support/fixtures';

interface ResultadoPrueba {
  nombre: string;
  resultado: 'OK' | 'FALLO';
  detalle: string;
  metricas?: Record<string, number>;
}

const reporte: ResultadoPrueba[] = [];

function escribirReporte(): void {
  const resumen = { fecha: new Date().toISOString(), pruebas: reporte };
  fs.writeFileSync(path.join(__dirname, 'reporte-estres.json'), JSON.stringify(resumen, null, 2));

  const lineas = [
    '# Reporte de pruebas de estrés y concurrencia — T3.2',
    '',
    `Generado: ${resumen.fecha}`,
    '',
    '| Prueba | Resultado | Detalle |',
    '|---|---|---|',
    ...reporte.map((p) => `| ${p.nombre} | ${p.resultado} | ${p.detalle} |`),
    '',
    '## Tiempos de respuesta',
    '',
    ...reporte
      .filter((p) => p.metricas)
      .map((p) => `- **${p.nombre}**: ${JSON.stringify(p.metricas)}`),
  ];
  fs.writeFileSync(path.join(__dirname, 'reporte-estres.md'), lineas.join('\n') + '\n');
}

describe('T3.2: Estrés y concurrencia de sincronización de campo', () => {
  let t: TestApp;
  let http: Api;

  beforeAll(async () => {
    t = await createTestApp();
    http = api(t.baseUrl);
  });

  beforeEach(async () => {
    await resetDb(t.db);
  });

  afterAll(async () => {
    escribirReporte();
    await t.close();
  });

  async function crearInspeccion(esc: Escenario): Promise<string> {
    const res = await http.post('/operaciones/inspecciones', { servicioId: esc.servicioId });
    return res.body.id as string;
  }

  function operacion(inspeccionId: string, actorId: string, numeroEstacion: number, operationId = randomUUID()) {
    return {
      operationId,
      tipo: 'REGISTRO_ESTACION',
      agregadoId: inspeccionId,
      actorId,
      clienteTimestamp: new Date().toISOString(),
      payload: { numeroEstacion, huboConsumo: false },
    };
  }

  it('carga alta: 100 técnicos registrando estaciones distintas al mismo tiempo no pierde ninguna', async () => {
    const esc = await crearEscenario(http);
    const id = await crearInspeccion(esc);
    const N = 100;

    const inicio = Date.now();
    const respuestas = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        http.post(`/operaciones/inspecciones/${id}/sincronizar`, { operaciones: [operacion(id, esc.tecnicoId, i)] }),
      ),
    );
    const duracionMs = Date.now() - inicio;

    const conError = respuestas.filter((r) => r.status !== 201);
    const { rows } = await t.db.query(
      `SELECT count(*)::int AS n FROM inspecciones_auditoria WHERE inspeccion_id = $1 AND accion = 'REGISTRO_ESTACION'`,
      [id],
    );

    reporte.push({
      nombre: 'Carga alta sin colisiones (100 peticiones concurrentes, estaciones distintas)',
      resultado: conError.length === 0 && rows[0].n === N ? 'OK' : 'FALLO',
      detalle: `${N - conError.length}/${N} respondieron 201, ${rows[0].n}/${N} quedaron guardadas en la auditoría`,
      metricas: { peticiones: N, duracionMs, porSegundo: Math.round((N / duracionMs) * 1000) },
    });

    expect(conError).toHaveLength(0);
    expect(rows[0].n).toBe(N);
  });

  it('idempotencia bajo carga: reenviar el mismo operationId en paralelo no debe duplicar el registro', async () => {
    const esc = await crearEscenario(http);
    const REPS = 20;
    let duplicados = 0;
    const inicio = Date.now();

    for (let i = 0; i < REPS; i++) {
      const id = await crearInspeccion(esc);
      const op = operacion(id, esc.tecnicoId, 1);
      await Promise.all([
        http.post(`/operaciones/inspecciones/${id}/sincronizar`, { operaciones: [op] }),
        http.post(`/operaciones/inspecciones/${id}/sincronizar`, { operaciones: [op] }),
      ]);
      const { rows } = await t.db.query(
        `SELECT count(*)::int AS n FROM inspecciones_auditoria WHERE inspeccion_id = $1 AND payload_nuevo->>'operationId' = $2`,
        [id, op.operationId],
      );
      if (rows[0].n > 1) duplicados++;
    }
    const duracionMs = Date.now() - inicio;

    reporte.push({
      nombre: 'Idempotencia bajo carga (mismo operationId, 20 repeticiones concurrentes)',
      resultado: duplicados === 0 ? 'OK' : 'FALLO',
      detalle:
        duplicados === 0
          ? 'Ninguna repetición duplicó el registro.'
          : `${duplicados}/${REPS} repeticiones duplicaron el registro en la auditoría (ver BUG-08 en Issues_QA_Fase1.md).`,
      metricas: { repeticiones: REPS, duracionMs },
    });

    // Si se corrige BUG-08, esta prueba pasa a estar en verde.
    expect(duplicados).toBe(0);
  });

  it('colisión bajo carga: dos técnicos escribiendo la misma estación al mismo tiempo deben dejar registrado el conflicto', async () => {
    const esc = await crearEscenario(http);
    const REPS = 20;
    let sinDetectar = 0;
    const inicio = Date.now();

    for (let i = 0; i < REPS; i++) {
      const id = await crearInspeccion(esc);
      const [rx, ry] = await Promise.all([
        http.post(`/operaciones/inspecciones/${id}/sincronizar`, { operaciones: [operacion(id, esc.tecnicoId, 1)] }),
        http.post(`/operaciones/inspecciones/${id}/sincronizar`, { operaciones: [operacion(id, esc.tecnicoId, 1)] }),
      ]);
      const huboConflicto = (rx.body.conflictos?.length ?? 0) > 0 || (ry.body.conflictos?.length ?? 0) > 0;
      if (!huboConflicto) sinDetectar++;
    }
    const duracionMs = Date.now() - inicio;

    reporte.push({
      nombre: 'Colisión bajo carga real (misma estación, 20 repeticiones concurrentes)',
      resultado: sinDetectar === 0 ? 'OK' : 'FALLO',
      detalle:
        sinDetectar === 0
          ? 'Todas las colisiones se detectaron.'
          : `${sinDetectar}/${REPS} colisiones no se detectaron cuando las dos peticiones llegaron realmente al mismo tiempo (ver BUG-08 en Issues_QA_Fase1.md).`,
      metricas: { repeticiones: REPS, duracionMs },
    });

    expect(sinDetectar).toBe(0);
  });
});
