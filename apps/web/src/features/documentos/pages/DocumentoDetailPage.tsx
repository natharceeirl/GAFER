import { useState } from 'react';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { StateStamp } from '../../../shared/ui/molecules/StateStamp';
import { CancelledStampOverlay } from '../../../shared/ui/molecules/CancelledStampOverlay';
import { Button } from '../../../shared/ui/atoms/Button';
import { ahora } from '../../../shared/lib/fecha';
import type { Rol } from '../../auth/model/roles';
import { useAuditoria } from '../../auditoria/model/auditoria-context';
import { useConfiguracion } from '../../mantenimiento/model/configuracion-context';
import { CATALOGOS_TEXTO_MOCK, INSUMOS_MOCK } from '../../mantenimiento/model/mantenimiento-mock';
import { useDocumentos } from '../model/documentos-context';
import {
  ETIQUETA_CAMPO,
  MAX_FOTOS_PDF,
  anexosAutomaticos,
  aprobar,
  fotosDisponibles,
  intervenir,
  marcarEnviado,
  modificarAprobado,
  observar,
  puedeDecidir,
  puedeIntervenir,
  puedeModificarAprobado,
  seleccionInicialFotos,
  validarSeleccionFotos,
  type CampoEditable,
} from '../model/flujo-documento';
import type { DocumentoDetalle } from '../model/tipos';
import './documento-detail-page.css';

interface DocumentoDetailPageProps {
  detalle: DocumentoDetalle;
  rol: Rol;
  usuario: string;
  onVolver: () => void;
}

type Modo = 'ver' | 'aprobando' | 'observando' | 'clave' | 'interviniendo' | 'modificando';

const CAMPOS: CampoEditable[] = ['diagnostico', 'trabajosRealizados', 'observaciones', 'recomendaciones'];
const MOTIVOS = CATALOGOS_TEXTO_MOCK.find((c) => c.id === 'motivos-modificacion')?.items ?? [];

/**
 * Revisión de un documento que llegó de campo (§8.3). Decisiones aplicadas:
 * aprueban ambos roles (C2), intervención con clave (C3), modificación
 * post-aprobación solo del Administrador (C4), fotos elegidas por quien
 * aprueba (C9), firma del Director Técnico (C7), certificado aparte (C13),
 * anexos automáticos (C14) y fotos que siguen llegando del celular (C15).
 */
export function DocumentoDetailPage({ detalle: doc, rol, usuario, onVolver }: DocumentoDetailPageProps) {
  const { actualizar } = useDocumentos();
  const { registrar } = useAuditoria();
  const { director } = useConfiguracion();

  const [modo, setModo] = useState<Modo>('ver');
  const [animar, setAnimar] = useState(false);
  const [seleccion, setSeleccion] = useState<number[]>(() => seleccionInicialFotos(doc));
  const [comentario, setComentario] = useState('');
  const [clave, setClave] = useState('');
  const [borrador, setBorrador] = useState<Record<CampoEditable, string>>(() => textos(doc));
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const ctx = { usuario, rol, fechaHora: ahora() };
  const editando = modo === 'interviniendo' || modo === 'modificando';
  const disponibles = fotosDisponibles(doc);
  const pendientes = doc.fotos - disponibles;

  function textos(d: DocumentoDetalle): Record<CampoEditable, string> {
    return { diagnostico: d.diagnostico, trabajosRealizados: d.trabajosRealizados, observaciones: d.observaciones, recomendaciones: d.recomendaciones };
  }

  function ejecutar(accion: () => void, mensaje: string, animarSello = true) {
    try {
      accion();
      setError(null);
      setAviso(mensaje);
      setModo('ver');
      if (animarSello) {
        setAnimar(true);
        window.setTimeout(() => setAnimar(false), 260);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    }
  }

  function confirmarAprobacion() {
    ejecutar(() => {
      const r = aprobar(doc, { ...ctx, fotosSeleccionadas: seleccion, insumos: INSUMOS_MOCK, director });
      actualizar(r.documento);
      registrar(r.evento);
    }, `Documento aprobado. Se generaron ${doc.numeroCertificado !== '—' ? 'el informe y el certificado' : 'el PDF'} con sus anexos.`);
  }

  function confirmarObservacion() {
    ejecutar(() => {
      const r = observar(doc, { ...ctx, comentario });
      actualizar(r.documento);
      registrar(r.evento);
    }, 'Documento observado: vuelve para corrección con su comentario.');
  }

  function guardarIntervencion() {
    ejecutar(() => {
      const r = intervenir(doc, borrador, ctx);
      actualizar(r.documento);
      registrar(...r.eventos);
    }, doc.estado === 'OBSERVADO' ? 'Corrección guardada: el documento vuelve a revisión.' : 'Intervención guardada y registrada en auditoría.', doc.estado === 'OBSERVADO');
  }

  function guardarModificacion() {
    ejecutar(() => {
      const r = modificarAprobado(doc, borrador, { ...ctx, motivo });
      actualizar(r.documento);
      registrar(...r.eventos);
    }, 'Modificación guardada con su motivo en la bitácora de auditoría.', false);
  }

  function enviarAlCliente() {
    ejecutar(() => {
      const r = marcarEnviado(doc, ctx);
      actualizar(r.documento);
      registrar(r.evento);
    }, 'Documento marcado como enviado al cliente.');
  }

  function abrirEdicion(siguiente: 'interviniendo' | 'modificando') {
    setBorrador(textos(doc));
    setMotivo('');
    setError(null);
    setModo(siguiente);
  }

  function alternarFoto(i: number) {
    setSeleccion((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b)));
  }

  const errorFotos = validarSeleccionFotos(seleccion);

  if (doc.estado === 'BORRADOR') {
    return (
      <div className="documento-page">
        <TicketHeader code={doc.codigo} title={`${doc.cliente} · ${doc.proyecto}`} meta={`${doc.tipo} · ${doc.fecha}`} action={<Volver onVolver={onVolver} />} />
        <div className="documento-page__body">
          <StateStamp estado="BORRADOR" />
          <p className="documento-nota">El técnico todavía no cerró esta inspección en la app Android. Aparecerá para revisión cuando la cierre.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="documento-page">
      <TicketHeader code={doc.codigo} title={`${doc.cliente} · ${doc.proyecto}`} meta={`${doc.tipo} · ${doc.fecha}`} action={<Volver onVolver={onVolver} />} />

      <div className="documento-page__body documento-page__body--relativo">
        {doc.estado === 'OBSERVADO' ? <CancelledStampOverlay /> : null}

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

        {doc.estado === 'OBSERVADO' && doc.comentarioObservacion ? (
          <p className="documento-comentario">
            <strong>Observación:</strong> {doc.comentarioObservacion}
          </p>
        ) : null}

        {pendientes > 0 ? (
          <p className="documento-sync" role="status">
            Datos y firma ya recibidos. Faltan {pendientes} de {doc.fotos} fotos, que siguen llegando desde el celular del técnico.
          </p>
        ) : null}

        {modo === 'modificando' ? (
          <div className="documento-edicion documento-edicion--modificar">
            <label htmlFor="doc-motivo">Motivo de la modificación</label>
            <select id="doc-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              <option value="">Seleccione un motivo del catálogo…</option>
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span>Queda registrado quién autorizó y ejecutó, qué campo cambió, el valor anterior y el nuevo.</span>
          </div>
        ) : null}

        {CAMPOS.slice(0, 2).map((c) => (
          <Seccion key={c} campo={c} valor={doc[c]} editando={editando} borrador={borrador} setBorrador={setBorrador} />
        ))}

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
              {doc.insumosUsados.map((insumo) => (
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
            {doc.personal.map((p) => (
              <li key={p.nombre}>
                {p.nombre} <span>· {p.cargo}</span>
              </li>
            ))}
          </ul>
        </section>

        {doc.accionesCorrectivas.length > 0 ? (
          <section className="documento-seccion">
            <h2>Acciones correctivas</h2>
            <ul>
              {doc.accionesCorrectivas.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {CAMPOS.slice(2).map((c) => (
          <Seccion key={c} campo={c} valor={doc[c]} editando={editando} borrador={borrador} setBorrador={setBorrador} />
        ))}

        <section className="documento-seccion">
          <h2>
            Fotografías{' '}
            {modo === 'aprobando' ? (
              <span className={errorFotos ? 'documento-contador documento-contador--error' : 'documento-contador'}>
                {seleccion.length} / {MAX_FOTOS_PDF} para el PDF
              </span>
            ) : doc.fotosSeleccionadas ? (
              <span className="documento-contador">{doc.fotosSeleccionadas.length} en el PDF</span>
            ) : null}
          </h2>
          {modo === 'aprobando' ? <p className="documento-ayuda">Toque una foto para incluirla o quitarla del PDF.</p> : null}
          <div className="documento-fotos">
            {Array.from({ length: doc.fotos }).map((_, i) => {
              const llego = i < disponibles;
              const elegida = modo === 'aprobando' ? seleccion.includes(i) : (doc.fotosSeleccionadas?.includes(i) ?? false);
              const clases = ['documento-foto-tile', llego ? '' : 'documento-foto-tile--pendiente', elegida ? 'documento-foto-tile--elegida' : '']
                .filter(Boolean)
                .join(' ');
              return modo === 'aprobando' && llego ? (
                <button key={i} type="button" className={clases} aria-pressed={elegida} onClick={() => alternarFoto(i)} aria-label={`Foto ${i + 1}`}>
                  {i + 1}
                </button>
              ) : (
                <div key={i} className={clases} aria-label={llego ? `Foto ${i + 1}` : `Foto ${i + 1}, en camino`}>
                  {llego ? i + 1 : '…'}
                </div>
              );
            })}
          </div>
          {modo === 'aprobando' && errorFotos ? <p className="documento-error-inline">{errorFotos}</p> : null}
        </section>

        <section className="documento-seccion documento-cierre">
          <h2>Cierre</h2>
          <dl className="documento-cierre__datos">
            <div>
              <dt>N° certificado</dt>
              <dd className="tabular">{doc.numeroCertificado}</dd>
            </div>
            <div>
              <dt>Vencimiento</dt>
              <dd className="tabular">{doc.vencimientoCertificado}</dd>
            </div>
            <div>
              <dt>Conformidad del cliente</dt>
              <dd>{doc.firmaCliente}</dd>
            </div>
            <div>
              <dt>Director Técnico</dt>
              <dd>
                {doc.firmaDirector ??
                  (director ? `Se estampará al aprobar: ${director.nombre} · CIP ${director.cip}` : 'Sin configurar en Mantenimiento')}
              </dd>
            </div>
          </dl>
        </section>

        {modo === 'aprobando' ? (
          <section className="documento-seccion documento-generacion">
            <h2>Al aprobar se genera</h2>
            <ul>
              <li>{doc.codigo}.pdf, con las fotos elegidas y la firma del Director Técnico</li>
              {doc.numeroCertificado !== '—' ? <li>{doc.numeroCertificado}.pdf — certificado de saneamiento de 1 hoja para imprimir</li> : null}
            </ul>
            <h3>Anexos que se adjuntan solos</h3>
            <ul>
              {anexosAutomaticos(doc, INSUMOS_MOCK).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {doc.generados ? (
          <section className="documento-seccion documento-generacion">
            <h2>Documentos generados</h2>
            <ul className="documento-archivos">
              {doc.generados.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <h3>Anexos incluidos</h3>
            <ul>
              {(doc.anexos ?? []).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="documento-acciones">
          {modo === 'ver' ? (
            <div className="documento-acciones__botones">
              {puedeIntervenir(doc.estado) ? (
                <Button variant="secondary" onClick={() => setModo('clave')}>
                  Intervenir con clave
                </Button>
              ) : null}
              {puedeDecidir(doc.estado) ? (
                <>
                  <Button variant="secondary" onClick={() => setModo('observando')}>
                    Observar
                  </Button>
                  <Button variant="primary" onClick={() => setModo('aprobando')}>
                    Aprobar…
                  </Button>
                </>
              ) : null}
              {doc.estado === 'APROBADO' ? (
                <>
                  {puedeModificarAprobado(rol, doc.estado) ? (
                    <Button variant="secondary" onClick={() => abrirEdicion('modificando')}>
                      Modificar documento aprobado
                    </Button>
                  ) : (
                    <span className="documento-acciones__nota">Solo el Administrador modifica documentos aprobados.</span>
                  )}
                  <Button variant="primary" onClick={enviarAlCliente}>
                    Marcar como enviado al cliente
                  </Button>
                </>
              ) : null}
              {doc.estado === 'ENVIADO' ? <span className="documento-acciones__nota">Documento entregado al cliente; ya no admite cambios.</span> : null}
            </div>
          ) : null}

          {modo === 'aprobando' ? (
            <div className="documento-acciones__botones">
              <Button variant="secondary" onClick={() => setModo('ver')}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={confirmarAprobacion} disabled={Boolean(errorFotos)}>
                Confirmar aprobación
              </Button>
            </div>
          ) : null}

          {modo === 'observando' ? (
            <div className="documento-observacion">
              <label htmlFor="comentario-observacion">Comentario de observación</label>
              <textarea
                id="comentario-observacion"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Indique qué debe corregirse antes de volver a enviar…"
                rows={3}
              />
              <div className="documento-observacion__botones">
                <Button variant="secondary" onClick={() => setModo('ver')}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={confirmarObservacion} disabled={!comentario.trim()}>
                  Confirmar observación
                </Button>
              </div>
            </div>
          ) : null}

          {modo === 'clave' ? (
            <form
              className="documento-observacion"
              onSubmit={(e) => {
                e.preventDefault();
                if (clave.trim()) {
                  setClave('');
                  abrirEdicion('interviniendo');
                }
              }}
            >
              <label htmlFor="doc-clave">Clave de intervención</label>
              <input
                id="doc-clave"
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <span className="documento-ayuda">La inspección está cerrada: cada cambio queda registrado a su nombre en la auditoría.</span>
              <div className="documento-observacion__botones">
                <Button type="button" variant="secondary" onClick={() => setModo('ver')}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={!clave.trim()}>
                  Desbloquear
                </Button>
              </div>
            </form>
          ) : null}

          {editando ? (
            <div className="documento-acciones__botones">
              <Button variant="secondary" onClick={() => setModo('ver')}>
                Descartar cambios
              </Button>
              <Button variant="primary" onClick={modo === 'modificando' ? guardarModificacion : guardarIntervencion}>
                {modo === 'modificando' ? 'Guardar modificación' : doc.estado === 'OBSERVADO' ? 'Guardar y reenviar a revisión' : 'Guardar intervención'}
              </Button>
            </div>
          ) : null}
        </section>
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

interface SeccionProps {
  campo: CampoEditable;
  valor: string;
  editando: boolean;
  borrador: Record<CampoEditable, string>;
  setBorrador: (actualizar: (prev: Record<CampoEditable, string>) => Record<CampoEditable, string>) => void;
}

function Seccion({ campo, valor, editando, borrador, setBorrador }: SeccionProps) {
  const id = `doc-${campo}`;
  return (
    <section className="documento-seccion">
      <h2>{editando ? <label htmlFor={id}>{ETIQUETA_CAMPO[campo]}</label> : ETIQUETA_CAMPO[campo]}</h2>
      {editando ? (
        <textarea
          id={id}
          className="documento-editable"
          value={borrador[campo]}
          onChange={(e) => setBorrador((prev) => ({ ...prev, [campo]: e.target.value }))}
          rows={3}
        />
      ) : (
        <p>{valor}</p>
      )}
    </section>
  );
}
