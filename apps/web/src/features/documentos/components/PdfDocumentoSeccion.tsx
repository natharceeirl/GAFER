import { Button } from '../../../shared/ui/atoms/Button';
import { etiquetaPdf, type PdfApi } from '../model/documento-mapper';

const CLASE: Record<string, string> = {
  PENDIENTE: 'badge badge--amarillo',
  GENERANDO: 'badge badge--amarillo',
  GENERADO: 'badge badge--verde',
  ERROR: 'badge badge--rojo',
};

interface Props {
  pdf: PdfApi;
  /** El documento ya está aprobado: solo entonces existe un informe definitivo. */
  aprobado: boolean;
  /** El rol puede generar, reintentar y descargar. */
  puedeGestionar: boolean;
  ocupado: boolean;
  onGenerar: () => void;
  onDescargar: () => void;
}

/** Estado de la generación asíncrona del PDF y sus acciones (generar/reintentar, descargar). */
export function PdfDocumentoSeccion({ pdf, aprobado, puedeGestionar, ocupado, onGenerar, onDescargar }: Props) {
  const enCurso = pdf.estado === 'PENDIENTE' || pdf.estado === 'GENERANDO';

  return (
    <section className="documento-seccion" aria-labelledby="pdf-titulo">
      <h2 id="pdf-titulo">PDF del informe</h2>
      {!aprobado ? (
        <p>Se genera cuando el documento está aprobado.</p>
      ) : (
        <>
          <div className="documento-pdf__estado">
            <span className={pdf.estado ? CLASE[pdf.estado] : 'badge badge--sin-color'}>{etiquetaPdf(pdf.estado)}</span>
            {pdf.estado === 'GENERADO' && pdf.generadoAt ? <span className="documento-ayuda">Generado el {new Date(pdf.generadoAt).toLocaleString('es-PE')}</span> : null}
          </div>
          {enCurso ? <p>El PDF se está preparando. Esta pantalla se actualiza sola.</p> : null}
          {pdf.estado === 'ERROR' && pdf.error ? <p className="documento-pdf__error">{pdf.error}</p> : null}
          {puedeGestionar && pdf.estado === 'GENERADO' ? (
            <Button variant="primary" onClick={onDescargar} disabled={ocupado}>
              Descargar PDF
            </Button>
          ) : null}
          {puedeGestionar && (pdf.estado === null || pdf.estado === 'ERROR') ? (
            <Button variant={pdf.estado === 'ERROR' ? 'secondary' : 'primary'} onClick={onGenerar} disabled={ocupado}>
              Generar PDF
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
