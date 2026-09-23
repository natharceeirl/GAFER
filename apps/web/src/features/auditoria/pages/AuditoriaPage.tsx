import { useMemo, useState } from 'react';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { useAuditoria } from '../model/auditoria-context';
import type { AccionAuditoria } from '../model/evento';
import './auditoria-page.css';

const ROL: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  SUPERVISOR: 'Supervisor',
  TECNICO_OPERADOR: 'Técnico Operador (app)',
};

/**
 * Bitácora de auditoría (§8.4), exclusiva del Administrador (decisión C6).
 * Es de solo lectura: no hay forma de editar ni borrar un evento.
 */
export function AuditoriaPage() {
  const { eventos } = useAuditoria();
  const [accion, setAccion] = useState<'' | AccionAuditoria>('');
  const [busqueda, setBusqueda] = useState('');

  const acciones = useMemo(() => Array.from(new Set(eventos.map((e) => e.accion))).sort(), [eventos]);
  const filas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return [...eventos]
      .filter((e) => (accion === '' || e.accion === accion) && (texto === '' || `${e.usuario} ${e.referencia} ${e.detalle}`.toLowerCase().includes(texto)))
      .sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));
  }, [eventos, accion, busqueda]);

  return (
    <div className="aud-page">
      <TicketHeader
        code={`${eventos.length} EVENTOS`}
        title="Bitácora de auditoría"
        meta="Solo lectura · ningún usuario puede modificar ni eliminar un registro"
      />
      <div className="aud-page__cuerpo">
        <div className="aud-filtros">
          <label>
            <span>Acción</span>
            <select id="aud-accion" value={accion} onChange={(e) => setAccion(e.target.value as '' | AccionAuditoria)}>
              <option value="">Todas</option>
              {acciones.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="aud-filtros__busqueda">
            <span>Buscar</span>
            <input
              id="aud-busqueda"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Usuario, documento o detalle…"
            />
          </label>
        </div>

        <div className="aud-tabla-marco">
          <table className="aud-tabla">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Referencia</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((e) => (
                <tr key={e.id}>
                  <td className="aud-tabla__mono">{e.fechaHora}</td>
                  <td>
                    <span className="aud-tabla__mono">{e.usuario}</span>
                    <span className="aud-tabla__rol">{ROL[e.rol]}</span>
                  </td>
                  <td className="aud-tabla__accion">{e.accion}</td>
                  <td className="aud-tabla__mono">{e.referencia}</td>
                  <td>
                    {e.campo ? (
                      <span className="aud-cambio">
                        <strong>{e.campo}:</strong> <del>{e.valorAnterior || '(vacío)'}</del> → <ins>{e.valorNuevo || '(vacío)'}</ins>
                      </span>
                    ) : null}
                    <span className="aud-detalle">{e.detalle}</span>
                    {e.autorizo ? (
                      <span className="aud-detalle">
                        Autorizó {e.autorizo} · ejecutó {e.ejecuto}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length === 0 ? <p className="aud-vacio">Ningún evento coincide con el filtro.</p> : null}
        </div>
      </div>
    </div>
  );
}
