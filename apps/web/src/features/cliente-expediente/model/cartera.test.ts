import { describe, expect, it } from 'vitest';
import {
  agregarCliente,
  agregarProyecto,
  agregarServicio,
  estadoInicialCartera,
  proyectosDe,
  sedesActivas,
} from './cartera';
import type { DatosCliente, DatosProyecto, DatosServicio } from './validaciones';

const cliente: DatosCliente = {
  razonSocial: 'Molinos del Sur S.A.C.',
  ruc: '20611122233',
  codigoCorto: 'MOLISUR',
  direccionFiscal: 'Av. Ejército 101',
  giro: 'Alimentos',
  contactoNombre: 'Carla Pinto',
  contactoCargo: 'Jefa de Calidad',
  contactoTelefono: '959123456',
  contactoCorreo: 'cpinto@molisur.pe',
  estado: 'ACTIVO',
};

const proyecto: DatosProyecto = {
  nombre: 'PLANTA_NORTE',
  direccion: 'Parque Industrial Mz. B',
  distrito: 'Cerro Colorado',
  provincia: 'Arequipa',
  departamento: 'Arequipa',
  contactoNombre: 'Luis Rojas',
  contactoCargo: 'Jefe de Planta',
  contactoTelefono: '054223344',
  estado: 'ACTIVO',
  observaciones: '',
};

const servicio: DatosServicio = {
  tipo: 'DRT',
  frecuencia: 'Quincenal',
  areaTotal: '1000',
  areaTratar: '800',
  insumos: ['i1'],
  dosis: { i1: '1 bloque por estación' },
  equipos: ['e2'],
  requiereCertificado: true,
  vigenciaDesde: '2026-10-01',
  vigenciaHasta: '2027-03-31',
  observaciones: '',
  estado: 'ACTIVO',
};

describe('cartera compartida (§7)', () => {
  it('un cliente de ejemplo trae las sedes de ejemplo; uno nuevo arranca sin sedes', () => {
    const inicial = estadoInicialCartera();
    expect(proyectosDe(inicial, inicial.clientes[0].id).length).toBeGreaterThan(0);

    const { estado, clienteId } = agregarCliente(inicial, cliente);
    expect(estado.clientes.at(-1)?.codigoCorto).toBe('MOLISUR');
    expect(proyectosDe(estado, clienteId)).toEqual([]);
  });

  it('agrega una sede y un servicio con lo que el técnico necesita precargado', () => {
    const paso1 = agregarCliente(estadoInicialCartera(), cliente);
    const paso2 = agregarProyecto(paso1.estado, paso1.clienteId, proyecto);
    const estado = agregarServicio(paso2.estado, paso1.clienteId, paso2.proyectoId, servicio);

    const [sede] = proyectosDe(estado, paso1.clienteId);
    expect(sede.nombre).toBe('PLANTA_NORTE');
    expect(sede.servicios).toHaveLength(1);
    expect(sede.servicios[0]).toMatchObject({
      tipoId: 'DRT',
      frecuencia: 'Quincenal',
      requiereCertificado: true,
      insumos: ['i1'],
      dosis: { i1: '1 bloque por estación' },
      equipos: ['e2'],
    });
  });

  it('no modifica el estado anterior', () => {
    const inicial = estadoInicialCartera();
    agregarCliente(inicial, cliente);
    expect(inicial.clientes.some((c) => c.codigoCorto === 'MOLISUR')).toBe(false);
  });

  it('lista solo sedes activas de clientes activos, para que el técnico elija (§3)', () => {
    const inicial = estadoInicialCartera();
    const sedes = sedesActivas(inicial);
    expect(sedes.length).toBeGreaterThan(0);
    expect(sedes.every((s) => s.cliente.estado === 'ACTIVO' && s.proyecto.estado === 'ACTIVO')).toBe(true);
  });
});
