import { useState } from 'react';
import type { EstadoDocumento } from '@gafer/contracts';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { StateStamp } from '../../../shared/ui/molecules/StateStamp';
import { CancelledStampOverlay } from '../../../shared/ui/molecules/CancelledStampOverlay';
import { Button } from '../../../shared/ui/atoms/Button';
import { DOCUMENTOS_DETALLE_MOCK } from '../model/documentos-mock';
import './documento-detail-page.css';

interface DocumentoDetailPageProps {
  documentoId?: string;
}

export function DocumentoDetailPage({ documentoId = 'd1' }: DocumentoDetailPageProps) {
  const base = DOCUMENTOS_DETALLE_MOCK[documentoId] ?? DOCUMENTOS_DETALLE_MOCK.d1;
  const [estado, setEstado] = useState<EstadoDocumento>(base.estado);
  const [justAnimated, setJustAnimated] = useState(false);
  const [mostrarObservacion, setMostrarObservacion] = useState(false);
  const [comentario, setComentario] = useState('');

  function transicionar(siguiente: EstadoDocumento) {
    setEstado(siguiente);
    setJustAnimated(true);
    setMostrarObservacion(false);
    window.setTimeout(() => setJustAnimated(false), 260);
  }

  function aprobar() {
    transicionar('APROBADO');
  }

  function confirmarObservacion() {
    if (!comentario.trim()) return;
    transicionar('OBSERVADO');
  }

  const puedeDecidir = estado === 'ENVIADO_A_REVISION';

  return (
    <div className="documento-page">
      <TicketHeader code={base.codigo} title={`${base.cliente} · ${base.proyecto}`} meta={`${base.tipo} · ${base.fecha}`} />

      <div className="documento-page__body documento-page__body--relativo">
        {estado === 'OBSERVADO' ? <CancelledStampOverlay /> : null}

        <div className="documento-estado-actual">
          <StateStamp estado={estado} animate={justAnimated} />
        </div>

        <section className="documento-seccion">
          <h2>Diagnóstico</h2>
          <p>{base.diagnostico}</p>
        </section>

        <section className="documento-seccion">
          <h2>Trabajos realizados</h2>
          <p>{base.trabajosRealizados}</p>
        </section>

        <section className="documento-seccion">
          <h2>Insumos utilizados</h2>
          <table className="documento-tabla tabular">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Lote</th>
                <th>Cantidad</th>
                <th>Concentración</th>
              </tr>
            </thead>
            <tbody>
              {base.insumosUsados.map((insumo) => (
                <tr key={insumo.producto + insumo.lote}>
                  <td>{insumo.producto}</td>
                  <td className="documento-tabla__mono">{insumo.lote}</td>
                  <td>{insumo.cantidad}</td>
                  <td>{insumo.concentracion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="documento-seccion">
          <h2>Personal</h2>
          <ul className="documento-personal">
            {base.personal.map((p) => (
              <li key={p.nombre}>
                {p.nombre} <span>· {p.cargo}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="documento-seccion">
          <h2>Acciones correctivas</h2>
          <ul>
            {base.accionesCorrectivas.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>

        <section className="documento-seccion">
          <h2>Observaciones y recomendaciones</h2>
          <p>{base.observaciones}</p>
          <p>{base.recomendaciones}</p>
        </section>

        <section className="documento-seccion">
          <h2>Fotografías</h2>
          <div className="documento-fotos">
            {Array.from({ length: base.fotos }).map((_, i) => (
              <div key={i} className="documento-foto-tile" aria-hidden="true" />
            ))}
          </div>
        </section>

        <section className="documento-seccion documento-cierre">
          <h2>Cierre</h2>
          <dl className="documento-cierre__datos">
            <div>
              <dt>N° certificado</dt>
              <dd className="tabular">{base.numeroCertificado}</dd>
            </div>
            <div>
              <dt>Vencimiento</dt>
              <dd className="tabular">{base.vencimientoCertificado}</dd>
            </div>
            <div>
              <dt>Conformidad del cliente</dt>
              <dd>{base.firmaCliente}</dd>
            </div>
          </dl>
        </section>

        {puedeDecidir && (
          <section className="documento-acciones">
            {mostrarObservacion ? (
              <div className="documento-observacion">
                <label htmlFor="comentario-observacion">Comentario de observación</label>
                <textarea
                  id="comentario-observacion"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Describí qué debe corregirse antes de volver a enviar…"
                  rows={3}
                />
                <div className="documento-observacion__botones">
                  <Button variant="secondary" onClick={() => setMostrarObservacion(false)}>
                    Cancelar
                  </Button>
                  <Button variant="primary" onClick={confirmarObservacion} disabled={!comentario.trim()}>
                    Confirmar observación
                  </Button>
                </div>
              </div>
            ) : (
              <div className="documento-acciones__botones">
                <Button variant="secondary" onClick={() => setMostrarObservacion(true)}>
                  Observar
                </Button>
                <Button variant="primary" onClick={aprobar}>
                  Aprobar
                </Button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
