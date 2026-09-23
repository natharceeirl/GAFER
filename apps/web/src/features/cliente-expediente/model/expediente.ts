import type { TipoDocumento } from '@gafer/contracts';
import { diasEntre, type ServicioRegistro } from '../../estadisticas/model/estadisticas';

export interface PdfCarpeta {
  servicioId: string;
  nombre: string;
  codigo: string;
  tipoDocumento: TipoDocumento;
  ruta: string;
  proyecto: string;
  fecha: string;
}

const pad = (n: number) => String(n).padStart(3, '0');

/**
 * Un PDF por servicio ejecutado. Desratización genera Reporte y el resto
 * Informe (§2); cada tipo lleva su correlativo continuo por cliente, en orden
 * cronológico. La carpeta sigue CLIENTE / PROYECTO / SERVICIO / AÑO (§3).
 */
export function carpetaDelCliente(historial: ServicioRegistro[], clienteId: string, codigoCorto: string): PdfCarpeta[] {
  const contador: Record<TipoDocumento, number> = { INFORME: 0, REPORTE: 0 };
  return historial
    .filter((s) => s.clienteId === clienteId && s.ejecutado)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id))
    .map((s) => {
      const tipoDocumento: TipoDocumento = s.tipo === 'DRT' ? 'REPORTE' : 'INFORME';
      contador[tipoDocumento] += 1;
      const anio = s.fecha.slice(0, 4);
      const codigo = `${tipoDocumento}-${codigoCorto}-${pad(contador[tipoDocumento])}-${anio}`;
      return {
        servicioId: s.id,
        nombre: `${codigo}.pdf`,
        codigo,
        tipoDocumento,
        ruta: `${codigoCorto} / ${s.proyecto} / ${s.tipo} / ${anio}`,
        proyecto: s.proyecto,
        fecha: s.fecha,
      };
    })
    .reverse();
}

/** Último correlativo emitido de cada tipo de documento (§3, numeración independiente por tipo). */
export function correlativos(carpeta: PdfCarpeta[]): Record<TipoDocumento, string | null> {
  const ultimo = (tipo: TipoDocumento) => carpeta.find((d) => d.tipoDocumento === tipo)?.codigo ?? null;
  return { INFORME: ultimo('INFORME'), REPORTE: ultimo('REPORTE') };
}

/** Historial cronológico de servicios ejecutados, por proyecto (§3). */
export function historialPorProyecto(historial: ServicioRegistro[], clienteId: string) {
  const propios = historial.filter((s) => s.clienteId === clienteId && s.ejecutado).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const proyectos = [...new Set(propios.map((s) => s.proyecto))].sort();
  return proyectos.map((proyecto) => ({ proyecto, servicios: propios.filter((s) => s.proyecto === proyecto) }));
}

/** Alerta de vencimiento según la anticipación configurada del cliente (§3). */
export function alertaVencimiento(proximoVencimiento: string | null, hoy: string, anticipacionDias: number) {
  if (!proximoVencimiento) return null;
  const dias = diasEntre(hoy, proximoVencimiento);
  if (dias > anticipacionDias) return null;
  return { dias, vencido: dias < 0 };
}
