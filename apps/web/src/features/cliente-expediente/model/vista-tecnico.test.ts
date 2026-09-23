import { describe, expect, it } from 'vitest';
import { vistaTecnico } from './vista-tecnico';
import { CLIENTES_MOCK } from './clientes-mock';
import type { ProyectoExpediente } from './expediente-mock';
import type { Insumo, Equipo } from '../../mantenimiento/model/tipos';
import type { VisitaProgramada } from '../../programacion/model/programacion';
import type { ServicioRegistro } from '../../estadisticas/model/estadisticas';

const cliente = CLIENTES_MOCK.find((c) => c.codigoCorto === 'KALLPA')!;

const insumos: Insumo[] = [
  { id: 'i1', nombre: 'Brodifacoum', principioActivo: 'B', presentacion: 'Bloque', concentracion: '0.005%', registroDigesa: 'DIG-1', dosisReferencial: '', estado: 'ACTIVO' },
  { id: 'i4', nombre: 'Deltametrina', principioActivo: 'D', presentacion: 'SC', concentracion: '2.5%', registroDigesa: 'DIG-4', dosisReferencial: '', estado: 'INACTIVO' },
];
const equipos: Equipo[] = [
  { id: 'e2', nombre: 'Aspersora', codigoInterno: 'EQ-022', tipo: 'Aspersión', estadoOperativo: 'OPERATIVO' },
  { id: 'e3', nombre: 'Termonebulizadora', codigoInterno: 'EQ-007', tipo: 'Termo', estadoOperativo: 'EN_MANTENIMIENTO' },
];

const proyectos: ProyectoExpediente[] = [
  {
    id: 'p1',
    nombre: 'CSF_SUNNY',
    direccion: 'Parque Industrial',
    estado: 'ACTIVO',
    servicios: [
      {
        id: 's1',
        tipoId: 'DRT',
        tipo: 'DRT — Desratización',
        frecuencia: 'Quincenal',
        requiereCertificado: true,
        insumos: ['i1', 'i4'],
        dosis: { i1: '1 bloque por estación', i4: '8 ml/L' },
        equipos: ['e2', 'e3'],
      },
    ],
  },
  { id: 'p3', nombre: 'OFICINA', direccion: 'Centro', estado: 'INACTIVO', servicios: [] },
];

const historial: ServicioRegistro[] = [
  { id: 'a', fecha: '2026-09-05', clienteId: cliente.id, cliente: 'KALLPA', proyecto: 'CSF_SUNNY', tipo: 'DRT', tecnico: 'Marco Ipusari', ejecutado: true, consumos: [] },
  { id: 'b', fecha: '2026-09-20', clienteId: cliente.id, cliente: 'KALLPA', proyecto: 'CSF_SUNNY', tipo: 'DRT', tecnico: null, ejecutado: false, consumos: [] },
  { id: 'c', fecha: '2026-08-21', clienteId: cliente.id, cliente: 'KALLPA', proyecto: 'CSF_SUNNY', tipo: 'DRT', tecnico: 'Jorge Huamán', ejecutado: true, consumos: [] },
];

const visitas: VisitaProgramada[] = [
  { id: 'v1', fecha: '2026-09-23', hora: '09:00', clienteId: cliente.id, proyectoId: 'p1', servicioId: 's1', tecnicoTitularId: null, observaciones: '', estadoCampo: 'PENDIENTE' },
  { id: 'v2', fecha: '2026-09-24', hora: '09:00', clienteId: cliente.id, proyectoId: 'p1', servicioId: 's1', tecnicoTitularId: null, observaciones: '', estadoCampo: 'PENDIENTE' },
];

const base = { cliente, proyectos, historial, visitas, hoy: '2026-09-23', insumos, equipos, estacionesRojo: [] };

describe('vistaTecnico (§3, §8.2): lo que el técnico ve del cliente en la app', () => {
  it('solo muestra sedes activas de un cliente activo', () => {
    expect(vistaTecnico(base).sedes.map((s) => s.nombre)).toEqual(['CSF_SUNNY']);
    expect(vistaTecnico({ ...base, cliente: { ...cliente, estado: 'INACTIVO' } }).sedes).toEqual([]);
  });

  it('precarga insumos autorizados activos con su dosis y los equipos con su estado', () => {
    const servicio = vistaTecnico(base).sedes[0].servicios[0];
    expect(servicio.insumos).toEqual([{ nombre: 'Brodifacoum', dosis: '1 bloque por estación', registroDigesa: 'DIG-1' }]);
    expect(servicio.equipos).toEqual([
      { nombre: 'Aspersora', codigo: 'EQ-022', operativo: true },
      { nombre: 'Termonebulizadora', codigo: 'EQ-007', operativo: false },
    ]);
  });

  it('indica la última visita ejecutada del servicio en esa sede', () => {
    expect(vistaTecnico(base).sedes[0].servicios[0].ultimaVisita).toEqual({ fecha: '2026-09-05', tecnico: 'Marco Ipusari' });
  });

  it('marca las visitas programadas para hoy en la sede', () => {
    expect(vistaTecnico(base).sedes[0].visitasHoy.map((v) => v.id)).toEqual(['v1']);
  });
});
