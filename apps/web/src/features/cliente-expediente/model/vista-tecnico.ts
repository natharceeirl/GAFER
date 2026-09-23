import type { TipoServicio } from '@gafer/contracts';
import type { ClienteFila } from './clientes-mock';
import type { ProyectoExpediente } from './expediente-mock';
import type { Equipo, Insumo } from '../../mantenimiento/model/tipos';
import { agendaDelDia, type VisitaProgramada } from '../../programacion/model/programacion';
import type { EstacionCritica, ServicioRegistro } from '../../estadisticas/model/estadisticas';

export interface ServicioTecnico {
  id: string;
  tipoId: TipoServicio;
  tipo: string;
  frecuencia: string;
  insumos: Array<{ nombre: string; dosis: string; registroDigesa: string }>;
  equipos: Array<{ nombre: string; codigo: string; operativo: boolean }>;
  ultimaVisita: { fecha: string; tecnico: string | null } | null;
}

export interface SedeTecnico {
  id: string;
  nombre: string;
  direccion: string;
  servicios: ServicioTecnico[];
  visitasHoy: VisitaProgramada[];
  estacionesRojo: EstacionCritica[];
}

interface Entrada {
  cliente: ClienteFila;
  proyectos: ProyectoExpediente[];
  historial: ServicioRegistro[];
  visitas: VisitaProgramada[];
  hoy: string;
  insumos: Insumo[];
  equipos: Equipo[];
  estacionesRojo: EstacionCritica[];
}

/**
 * Lo que el técnico ve de un cliente en la app Android: cualquier sede
 * activa (§3, §8.2) con lo que el formulario de campo precarga. Sin
 * documentos, correlativos ni datos comerciales: eso queda en la web.
 */
export function vistaTecnico({ cliente, proyectos, historial, visitas, hoy, insumos, equipos, estacionesRojo }: Entrada): { sedes: SedeTecnico[] } {
  if (cliente.estado !== 'ACTIVO') return { sedes: [] };
  const deHoy = agendaDelDia(visitas, hoy).filter((v) => v.clienteId === cliente.id);

  const sedes = proyectos
    .filter((p) => p.estado === 'ACTIVO')
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      direccion: p.distrito ? `${p.direccion}, ${p.distrito}` : p.direccion,
      visitasHoy: deHoy.filter((v) => v.proyectoId === p.id),
      estacionesRojo: estacionesRojo.filter((e) => e.cliente === cliente.codigoCorto && e.proyecto === p.nombre),
      servicios: p.servicios.map((s) => {
        const ultima = historial
          .filter((h) => h.clienteId === cliente.id && h.ejecutado && h.proyecto === p.nombre && h.tipo === s.tipoId)
          .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
        return {
          id: s.id,
          tipoId: s.tipoId,
          tipo: s.tipo,
          frecuencia: s.frecuencia,
          insumos: s.insumos.flatMap((id) => {
            const insumo = insumos.find((i) => i.id === id && i.estado === 'ACTIVO');
            return insumo ? [{ nombre: insumo.nombre, dosis: s.dosis[id] ?? insumo.dosisReferencial, registroDigesa: insumo.registroDigesa }] : [];
          }),
          equipos: s.equipos.flatMap((id) => {
            const equipo = equipos.find((e) => e.id === id);
            return equipo ? [{ nombre: equipo.nombre, codigo: equipo.codigoInterno, operativo: equipo.estadoOperativo === 'OPERATIVO' }] : [];
          }),
          ultimaVisita: ultima ? { fecha: ultima.fecha, tecnico: ultima.tecnico } : null,
        };
      }),
    }));

  return { sedes };
}
