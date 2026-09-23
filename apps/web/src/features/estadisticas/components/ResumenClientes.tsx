import { diasEntre, resumenClientes, type ServicioRegistro } from '../model/estadisticas';

interface Props {
  historial: ServicioRegistro[];
  hoy: string;
  clientes: Parameters<typeof resumenClientes>[1];
}

function claseVencimiento(dias: number | null) {
  if (dias === null) return '';
  if (dias < 0) return 'dash-tabla__venc--rojo';
  if (dias <= 30) return 'dash-tabla__venc--naranja';
  if (dias <= 60) return 'dash-tabla__venc--amarillo';
  return '';
}

/** Vista resumen de todos los clientes (§11): último servicio, próximos vencimientos y consumos recientes. */
export function ResumenClientes({ historial, hoy, clientes }: Props) {
  const filas = resumenClientes(historial, clientes, hoy);
  return (
    <div className="dash-tabla-marco">
      <table className="dash-tabla">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Último servicio</th>
            <th>Próximo vencimiento</th>
            <th>Consumo de los últimos 30 días</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const diasUltimo = f.ultimoServicio ? diasEntre(f.ultimoServicio, hoy) : null;
            const diasVenc = f.proximoVencimiento ? diasEntre(hoy, f.proximoVencimiento) : null;
            return (
              <tr key={f.cliente}>
                <td>
                  <strong>{f.cliente}</strong>
                  <span className="dash-tabla__sub">{f.razonSocial}</span>
                </td>
                <td className="tabular">
                  {f.ultimoServicio ?? '—'}
                  {diasUltimo !== null ? (
                    <span className={diasUltimo > 90 ? 'dash-tabla__sub dash-tabla__venc--rojo' : 'dash-tabla__sub'}>hace {diasUltimo} días</span>
                  ) : null}
                </td>
                <td className={`tabular ${claseVencimiento(diasVenc)}`}>
                  {f.proximoVencimiento ?? '—'}
                  {diasVenc !== null ? (
                    <span className="dash-tabla__sub">{diasVenc < 0 ? `vencido hace ${-diasVenc} días` : `en ${diasVenc} días`}</span>
                  ) : null}
                </td>
                <td>{f.consumoReciente.length === 0 ? <span className="dash-tabla__sub">Sin consumo</span> : f.consumoReciente.join(' · ')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
