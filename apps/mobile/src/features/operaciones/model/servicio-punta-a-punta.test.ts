import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  inicializarBaseDeDatos,
  cerrarBaseDeDatos,
} from '../../../shared/db/sqlite';
import { OutboxQueue } from '../../../shared/db/outbox';
import { BorradorRepository } from './borrador-repository';
import { useBorradorStore } from './use-borrador-store';
import {
  crearFormularioCampo,
  validarCierre,
  aCerrarInspeccionPayload,
  tipoDocumentoDe,
  INSUMOS_CATALOGO_SEMILLA,
  EQUIPOS_CATALOGO_SEMILLA,
} from './formulario-campo';

describe('Flujo de Inspección Móvil de Punta a Punta (DoD GAF-34)', () => {
  let repo: BorradorRepository;

  beforeEach(async () => {
    await cerrarBaseDeDatos();
    const db = await inicializarBaseDeDatos();
    repo = new BorradorRepository(db);
    await repo.limpiarTodos();
    useBorradorStore.getState().restaurarBorrador(null);
  });

  afterEach(async () => {
    await cerrarBaseDeDatos();
  });

  it('completa un servicio de ejemplo de punta a punta sin conexion (Offline-First)', async () => {
    // 1. El técnico selecciona una visita o sede de la agenda y se precarga el formulario (§8.2)
    const servicioEjemplo = {
      id: 'srv-e2e-001',
      tipo: 'DESINSECTACION Y DESRATIZACION (DRT)',
      tipoServicio: 'DRT' as const,
      requiereCertificado: true,
      insumosAutorizados: [
        {
          insumoId: INSUMOS_CATALOGO_SEMILLA[1].id,
          nombreComercial: INSUMOS_CATALOGO_SEMILLA[1].nombreComercial,
          principioActivo: INSUMOS_CATALOGO_SEMILLA[1].principioActivo,
          dosisReferencial: '1 bloque (20 g) por estación',
        },
      ],
      dosisReferencial: {
        [INSUMOS_CATALOGO_SEMILLA[1].id]: '1 bloque (20 g) por estación',
      },
      equiposAutorizados: [
        EQUIPOS_CATALOGO_SEMILLA[0].id,
        EQUIPOS_CATALOGO_SEMILLA[4].id,
      ],
    };

    const formulario = crearFormularioCampo({
      cliente: {
        id: 'cli-e2e-01',
        codigo: 'ALICORP',
        razonSocial: 'ALICORP S.A.A.',
      },
      sede: {
        id: 'sede-e2e-01',
        nombre: 'PLANTA_CALLAO',
        direccion: 'Av. Argentina 4793',
      },
      servicio: servicioEjemplo,
      tecnicoNombre: 'Marco Ipusari',
      tecnicoId: 'tec-marco-001',
    });

    // Verificación de precarga (§8.2)
    expect(formulario.estado).toBe('BORRADOR');
    expect(formulario.clienteRazon).toBe('ALICORP S.A.A.');
    expect(formulario.proyectoNombre).toBe('PLANTA_CALLAO');
    expect(formulario.insumos).toHaveLength(1);
    expect(formulario.insumos[0].nombreComercial).toBe('DemoRaticida Bloque B');
    expect(formulario.insumos[0].dosisReferencial).toBe('1 bloque (20 g) por estación');
    expect(formulario.equipos).toHaveLength(2);
    expect(formulario.personal).toEqual(['Marco Ipusari']);

    // 2. Persistencia inicial en SQLite ("Durable before visible")
    await repo.guardarCampo(formulario);
    const borradorGuardado = await repo.obtenerPorServicioId(formulario.servicioId);
    expect(borradorGuardado).not.toBeNull();
    expect(borradorGuardado?.datosCampo?.clienteRazon).toBe('ALICORP S.A.A.');

    // 3. El técnico llena los bloques en campo (§4)
    // Bloque 1: Horas y personal
    formulario.horaInicio = '08:30';
    formulario.horaFin = '11:00';
    formulario.personal.push('Diana Amamani'); // Técnico acompañante

    // Bloque 2: Herramientas y equipos (utilizó la motomochila)
    formulario.equipos = [EQUIPOS_CATALOGO_SEMILLA[0].id];

    // Bloque 3: Insumos aplicados (registra lote, vencimiento, cantidad real y zonas)
    formulario.insumos[0].aplicado = true;
    formulario.insumos[0].lote = 'L-ALICORP-2026-X';
    formulario.insumos[0].vencimiento = '2028-06-30';
    formulario.insumos[0].dosisReal = '1 bloque (20 g) por estación';
    formulario.insumos[0].cantidad = '12';
    formulario.insumos[0].unidad = 'bloque';
    formulario.insumos[0].zonas = 'Perímetro externo, garita 1 y nave de empaque';

    // Bloque 4: Método de aplicación
    formulario.metodos = ['Cebado', 'Aspersión'];

    // Bloque 5: Condiciones ambientales
    formulario.temperatura = '21.5';
    formulario.humedad = '68';
    formulario.viento = '9.2';

    // Bloque 6: Diagnóstico y hallazgos
    formulario.estadoGeneral = 'Bueno';
    formulario.nivelInfestacion = 'Bajo';
    formulario.hallazgos = ['Actividad de roedores en área perimetral'];
    formulario.hallazgosDetalle = 'Cebaderos 12 y 14 con consumo parcial de cebo.';
    formulario.acciones = ['Refuerzo de cebado perimetral'];
    formulario.observaciones = ['Acceso normal a todas las zonas asignadas'];
    formulario.observacionesLibre = 'Monitoreo preventivo ejecutado según cronograma mensual.';
    formulario.recomendaciones = ['Mantener despejada la franja de 30 cm de los zócalos'];

    // Bloque 7: Conformidad del cliente con firma
    formulario.responsableNoDisponible = false;
    formulario.firmanteNombre = 'Carlos Paredes';
    formulario.firmanteCargo = 'Jefe de Seguridad y Calidad';
    formulario.firma = 'data:image/svg+xml;base64,mockTrazoFirmaE2E...';

    // Bloque 8: Certificado de saneamiento
    formulario.certificadoNumero = 'CERT-ALICORP-CALLAO-042-2026';
    formulario.certificadoEmision = '2026-11-03';
    formulario.certificadoVencimiento = '2026-12-03';

    // 4. Validación estricta previa al cierre: debe estar 100% limpia
    const erroresValidacion = validarCierre(formulario);
    expect(erroresValidacion).toEqual({});

    // 5. El técnico cierra la inspección y encola para sincronización
    const { operationId } = await repo.finalizarYEncolarCampo(formulario, 'tec-marco-001');
    expect(operationId).toBeDefined();

    // 6. El borrador activo local se elimina de la tabla de trabajo
    const borradorPostCierre = await repo.obtenerPorServicioId(formulario.servicioId);
    expect(borradorPostCierre).toBeNull();

    // 7. La operación se encuentra en la Outbox SQLite con prioridad HIGH
    const outbox = new OutboxQueue();
    await outbox.inicializar();
    const operacionesPendientes = outbox.obtenerPendientes();
    expect(operacionesPendientes).toHaveLength(1);

    const operacion = operacionesPendientes[0].operacion;
    expect(operacion.operationId).toBe(operationId);
    expect(operacion.tipo).toBe('REGISTRO_SERVICIO_CAMPO');
    expect(operacion.agregadoId).toBe(formulario.servicioId);
    expect(operacion.actorId).toBe('tec-marco-001');

    // 8. El payload encolado contiene el formulario completo en estado ENVIADO_A_REVISION
    const payload = operacion.payload as any;
    expect(payload.estado).toBe('ENVIADO_A_REVISION');
    expect(payload.clienteRazon).toBe('ALICORP S.A.A.');
    expect(payload.insumos[0].lote).toBe('L-ALICORP-2026-X');
    expect(payload.insumos[0].cantidad).toBe('12');
    expect(payload.firma).toBeDefined();
    expect(payload.certificadoNumero).toBe('CERT-ALICORP-CALLAO-042-2026');

    // 9. Mapeo al contrato estándar CerrarInspeccion (@gafer/contracts)
    const payloadContrato = aCerrarInspeccionPayload(formulario);
    expect(payloadContrato.consumos).toHaveLength(1);
    expect(payloadContrato.consumos?.[0].insumoId).toBe(INSUMOS_CATALOGO_SEMILLA[1].id);
    expect(payloadContrato.consumos?.[0].cantidadUtilizada).toBe(12);
    expect(payloadContrato.equiposIds).toEqual([EQUIPOS_CATALOGO_SEMILLA[0].id]);

    // 10. Tipo de documento resultante
    expect(tipoDocumentoDe(formulario.tipoServicio)).toBe('REPORTE');
  });
});
