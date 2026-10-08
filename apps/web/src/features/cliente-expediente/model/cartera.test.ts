import { describe, expect, it } from 'vitest';
import {
  agregarProyecto,
  agregarServicio,
  esClienteDeEjemplo,
  estadoInicialCartera,
  proyectosDe,
  sedesActivas,
} from './cartera';
import type { DatosProyecto, DatosServicio } from './validaciones';

/** Un cliente del API: su id no está entre los de ejemplo. */
const CLIENTE_API = '3f0c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a11';

const proyecto: DatosProyecto = {
  nombre: 'PLANTA_NORTE',
  direccion: 'Parque Industrial Mz. B',
  distrito: 'Cerro Colorado',
  provincia: 'Arequipa',
  departamento: 'Arequipa',
  contactoNombre: 'Luis Rojas',
  contactoCargo: 'Jefe de Planta',
  contactoTelefono: '054223344',
  observaciones: '',
};

const servicio: DatosServicio = {
  tipo: 'DRT',
  frecuencia: 'QUINCENAL',
  areaTotal: '1000',
  areaTratar: '800',
  insumos: ['i1'],
  dosis: { i1: '1 bloque por estación' },
  equipos: ['e2'],
  requiereCertificado: true,
  vigenciaDias: '180',
};

describe('cartera compartida (§7)', () => {
  it('un cliente de ejemplo trae las sedes de ejemplo; uno del API arranca sin sedes', () => {
    const inicial = estadoInicialCartera();
    expect(esClienteDeEjemplo(inicial, inicial.clientes[0].id)).toBe(true);
    expect(proyectosDe(inicial, inicial.clientes[0].id).length).toBeGreaterThan(0);

    expect(esClienteDeEjemplo(inicial, CLIENTE_API)).toBe(false);
    expect(proyectosDe(inicial, CLIENTE_API)).toEqual([]);
  });

  it('agrega una sede y un servicio con lo que el técnico necesita precargado', () => {
    const paso1 = agregarProyecto(estadoInicialCartera(), CLIENTE_API, proyecto);
    const estado = agregarServicio(paso1.estado, CLIENTE_API, paso1.proyectoId, servicio);

    const [sede] = proyectosDe(estado, CLIENTE_API);
    expect(sede.nombre).toBe('PLANTA_NORTE');
    expect(sede.servicios).toHaveLength(1);
    expect(sede.servicios[0]).toMatchObject({
      tipoServicio: 'DRT',
      frecuencia: 'QUINCENAL',
      requiereCertificado: true,
      vigenciaDias: 180,
      insumosAutorizados: ['i1'],
      dosisReferencial: { i1: '1 bloque por estación' },
      equiposAutorizados: ['e2'],
    });
  });

  it('no modifica el estado anterior', () => {
    const inicial = estadoInicialCartera();
    agregarProyecto(inicial, CLIENTE_API, proyecto);
    expect(inicial.proyectosPorCliente[CLIENTE_API]).toBeUndefined();
  });

  it('lista solo sedes activas de clientes activos, para que el técnico elija (§3)', () => {
    const inicial = estadoInicialCartera();
    const sedes = sedesActivas(inicial);
    expect(sedes.length).toBeGreaterThan(0);
    expect(sedes.every((s) => s.cliente.estado === 'ACTIVO' && s.proyecto.estado === 'ACTIVO')).toBe(true);
  });
});
