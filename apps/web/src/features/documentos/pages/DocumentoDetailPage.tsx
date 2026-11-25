import { useState } from 'react';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { StateStamp } from '../../../shared/ui/molecules/StateStamp';
import { Button } from '../../../shared/ui/atoms/Button';
import { mensajeDeError } from '../../../shared/api/errores';
import type { Rol } from '../../auth/model/roles';
import { useDescargarPdf, useDocumento, useSolicitarPdf, useTransicionarDocumento } from '../api/use-documentos';
import { CargandoDocumentos, ErrorLecturaDocumentos } from '../components/EstadoConsultaDocumentos';
import { ETIQUETA_ESTADO } from '../components/EstadoBadge';
import { PdfDocumentoSeccion } from '../components/PdfDocumentoSeccion';
import { guardarArchivo as guardarArchivoNavegador } from '../model/descarga';
import { puedeGenerarPdf, puedeGestionarPdf } from '../model/documento-mapper';
import './documento-detail-page.css';

interface DocumentoDetailPageProps {
  id: string;
  rol: Rol;
  onVolver: () => void;
  /** Entrega el PDF descargado al navegador; se reemplaza en las pruebas. */
  guardarArchivo?: (blob: Blob, nombre: string) => void;
}

const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-PE');

/**
 * Revisión de un documento: datos, historial de estados, aprobación (solo en revisión) y PDF.
 * Observar o devolver para corrección llega con GAF-48; el envío al cliente y las firmas, en entregas posteriores.
 */
export function DocumentoDetailPage({ id, rol, onVolver, guardarArchivo = guardarArchivoNavegador }: DocumentoDetailPageProps) {
  const consulta = useDocumento(id);
  const transicionar = useTransicionarDocumento();
  const solicitarPdf = useSolicitarPdf();
  const descargarPdf = useDescargarPdf();

  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animar, setAnimar] = useState(false);

  const volver = <Volver onVolver={onVolver} />;

  if (consulta.isPending) {
    return (
      <div className="documento-page">
        <TicketHeader code="Documento" title="Detalle del documento" meta="Datos, historial y PDF" action={volver} />
        <div className="documento-page__body">
          <CargandoDocumentos mensaje="Cargando documento…" />
        </div>
      </div>
    );
  }

  if (consulta.isError) {
    return (
      <div className="documento-page">
        <TicketHeader code="Documento" title="Detalle del documento" meta="Datos, historial y PDF" action={volver} />
        <div className="documento-page__body">
          <ErrorLecturaDocumentos error={consulta.error} recurso="este documento" onReintentar={() => void consulta.refetch()} />
        </div>
      </div>
    );
  }

  const { fila: doc, historial, pdf } = consulta.data;
  const gestionaPdf = puedeGestionarPdf(rol);

  async function aprobar() {
    setError(null);
    setAviso(null);
    try {
      await transicionar.mutateAsync({ id, nuevoEstado: 'APROBADO', motivo });
      setConfirmando(false);
      setMotivo('');
      setAviso('Documento aprobado.');
      setAnimar(true);
      window.setTimeout(() => setAnimar(false), 260);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  async function generarPdf() {
    setError(null);
    setAviso(null);
    try {
      await solicitarPdf.mutateAsync(id);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  async function descargar() {
    setError(null);
    setAviso(null);
    try {
      guardarArchivo(await descargarPdf.mutateAsync(id), `${doc.codigo}.pdf`);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <div className="documento-page">
      <TicketHeader code={doc.codigo} title={`${doc.cliente} · ${doc.proyecto}`} meta={`${doc.tipo} · ${doc.fecha}`} action={volver} />

      <div className="documento-page__body">
        <div className="documento-estado-actual">
          <StateStamp estado={doc.estado} animate={animar} />
        </div>

        {aviso ? (
          <p className="documento-aviso" role="status">
            {aviso}
          </p>
        ) : null}
        {error ? (
          <p className="documento-error" role="alert">
            {error}
          </p>
        ) : null}

        {doc.estado === 'BORRADOR' || doc.estado === 'CERRADO' ? (
          <p className="documento-nota">El técnico todavía no lo ha enviado a revisión. Aparecerá para aprobar cuando lo envíe desde la app Android.</p>
        ) : null}

        <section className="documento-seccion" aria-labelledby="datos-titulo">
          <h2 id="datos-titulo">Datos del documento</h2>
          <dl className="documento-datos">
            <div>
              <dt>Cliente</dt>
              <dd>{doc.cliente}</dd>
            </div>
            <div>
              <dt>Sede</dt>
              <dd>{doc.proyecto}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{doc.tipo}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd className="tabular">{doc.fecha}</dd>
            </div>
          </dl>
        </section>

        <section className="documento-seccion" aria-labelledby="historial-titulo">
          <h2 id="historial-titulo">Historial</h2>
          <ol className="documento-historial" aria-label="Historial de estados">
            {historial.map((e, i) => (
              <li key={`${e.fecha}-${i}`} className="documento-historial__item">
                <span className="documento-historial__cambio">
                  {e.estadoAnterior ? `${ETIQUETA_ESTADO[e.estadoAnterior]} → ${ETIQUETA_ESTADO[e.estadoNuevo]}` : ETIQUETA_ESTADO[e.estadoNuevo]}
                </span>
                <span className="documento-historial__meta">
                  {e.usuario} · {e.rol} · <span className="tabular">{fechaHora(e.fecha)}</span>
                </span>
                {e.motivo ? <span className="documento-historial__motivo">{e.motivo}</span> : null}
              </li>
            ))}
          </ol>
        </section>

        <PdfDocumentoSeccion
          pdf={pdf}
          aprobado={puedeGenerarPdf(doc.estado)}
          puedeGestionar={gestionaPdf}
          ocupado={solicitarPdf.isPending || descargarPdf.isPending}
          onGenerar={() => void generarPdf()}
          onDescargar={() => void descargar()}
        />

        {doc.estado === 'ENVIADO_A_REVISION' ? (
          <section className="documento-acciones" aria-label="Acciones del documento">
            {confirmando ? (
              <div className="documento-confirmacion">
                <label htmlFor="doc-motivo-aprobacion">Motivo (opcional)</label>
                <textarea
                  id="doc-motivo-aprobacion"
                  rows={2}
                  maxLength={500}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Puede dejar una nota para el historial…"
                />
                <div className="documento-confirmacion__botones">
                  <Button variant="secondary" onClick={() => setConfirmando(false)} disabled={transicionar.isPending}>
                    Cancelar
                  </Button>
                  <Button variant="primary" onClick={() => void aprobar()} disabled={transicionar.isPending}>
                    Confirmar aprobación
                  </Button>
                </div>
              </div>
            ) : (
              <div className="documento-acciones__botones">
                <Button variant="primary" onClick={() => setConfirmando(true)}>
                  Aprobar documento
                </Button>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Volver({ onVolver }: { onVolver: () => void }) {
  return (
    <button type="button" className="documento-volver" onClick={onVolver}>
      ← Bandeja de documentos
    </button>
  );
}
