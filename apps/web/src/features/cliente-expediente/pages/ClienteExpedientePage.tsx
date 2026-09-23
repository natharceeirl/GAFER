import { useState } from 'react';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { FoldPanel } from '../../../shared/ui/molecules/FoldPanel';
import { PerforatedDivider } from '../../../shared/ui/molecules/PerforatedDivider';
import { Button } from '../../../shared/ui/atoms/Button';
import { Badge } from '../../../shared/ui/atoms/Badge';
import type { ClienteFila } from '../model/clientes-mock';
import type { ProyectoExpediente } from '../model/expediente-mock';
import { alertaVencimiento, carpetaDelCliente, correlativos, historialPorProyecto, type PdfCarpeta } from '../model/expediente';
import type { EstacionCritica, ServicioRegistro } from '../../estadisticas/model/estadisticas';
import type { SedeTecnico } from '../model/vista-tecnico';
import { VistaTecnicoApp } from '../components/VistaTecnicoApp';
import './cliente-expediente-page.css';

interface Props {
  cliente: ClienteFila;
  proyectos: ProyectoExpediente[];
  /** Historial de servicios de la cartera; la página filtra el del cliente. */
  historial: ServicioRegistro[];
  hoy: string;
  /** Solo se pasa si el cliente tiene Desratización contratada (§5). */
  programaRoedores: { estacionesRojo: EstacionCritica[] } | null;
  /** Maqueta de lo que ve el técnico en la app Android (C10). */
  vistaApp: { sedes: SedeTecnico[]; tecnico: string };
  puedeDarDeAlta: boolean;
  aviso: string | null;
  onVolver: () => void;
  onEditarFicha: () => void;
  onNuevoProyecto: () => void;
  onNuevoServicio: (proyectoId: string) => void;
  onAbrirMapaMurino: () => void;
}

const fechaLarga = (f: string) => new Date(`${f}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
const fechaCorta = (f: string) => new Date(`${f}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

function agruparPorRuta(pdfs: PdfCarpeta[]) {
  const grupos = new Map<string, PdfCarpeta[]>();
  for (const pdf of pdfs) grupos.set(pdf.ruta, [...(grupos.get(pdf.ruta) ?? []), pdf]);
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** Expediente digital del cliente — spec §2 y §3: ficha, sedes, historial, numeración y carpeta de PDF. */
export function ClienteExpedientePage({
  cliente,
  proyectos,
  historial,
  hoy,
  programaRoedores,
  vistaApp,
  puedeDarDeAlta,
  aviso,
  onVolver,
  onEditarFicha,
  onNuevoProyecto,
  onNuevoServicio,
  onAbrirMapaMurino,
}: Props) {
  const proyectosActivos = proyectos.filter((p) => p.estado === 'ACTIVO');
  const proyectosInactivos = proyectos.filter((p) => p.estado === 'INACTIVO');
  const carpeta = carpetaDelCliente(historial, cliente.id, cliente.codigoCorto);
  const ultimos = correlativos(carpeta);
  const codigoDe = new Map(carpeta.map((d) => [d.servicioId, d.codigo]));
  const porProyecto = historialPorProyecto(historial, cliente.id);
  const alerta = cliente.estado === 'ACTIVO' ? alertaVencimiento(cliente.proximoVencimiento, hoy, cliente.anticipacionAlertaDias) : null;
  const { contacto } = cliente;
  const [verApp, setVerApp] = useState(false);

  return (
    <div className="expediente-page">
      <TicketHeader
        code={`${cliente.codigoCorto} · RUC ${cliente.ruc}`}
        title={cliente.razonSocial}
        meta={`${cliente.giro} · expediente digital`}
        action={
          <button type="button" className="expediente-page__volver" onClick={onVolver}>
            ← Volver a la cartera
          </button>
        }
      />

      <div className="expediente-page__body">
        {aviso ? (
          <p className="expediente-aviso" role="status">
            {aviso}
          </p>
        ) : null}

        {alerta && cliente.proximoVencimiento ? (
          <p className={`expediente-alerta${alerta.vencido ? ' expediente-alerta--vencido' : ''}`} role="alert">
            {alerta.vencido
              ? `El certificado venció el ${fechaLarga(cliente.proximoVencimiento)}.`
              : `El certificado vence el ${fechaLarga(cliente.proximoVencimiento)} (en ${alerta.dias} ${alerta.dias === 1 ? 'día' : 'días'}).`}
          </p>
        ) : null}

        <section className="expediente-ficha" aria-labelledby="ficha-titulo">
          <header className="expediente-ficha__cabecera">
            <h2 id="ficha-titulo" className="expediente-ficha__titulo">
              Ficha del cliente
            </h2>
            <Badge color={cliente.estado === 'ACTIVO' ? 'VERDE' : 'SIN_COLOR'}>{cliente.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}</Badge>
            {puedeDarDeAlta ? (
              <button type="button" className="expediente-proyecto__agregar" onClick={onEditarFicha}>
                Editar ficha
              </button>
            ) : null}
          </header>
          <dl className="expediente-ficha__datos">
            <div className="expediente-ficha__dato expediente-ficha__dato--completo">
              <dt>Razón social</dt>
              <dd>{cliente.razonSocial}</dd>
            </div>
            <div className="expediente-ficha__dato">
              <dt>RUC</dt>
              <dd className="expediente-ficha__mono">{cliente.ruc}</dd>
            </div>
            <div className="expediente-ficha__dato">
              <dt>Código corto</dt>
              <dd className="expediente-ficha__mono">{cliente.codigoCorto}</dd>
            </div>
            <div className="expediente-ficha__dato">
              <dt>Giro del negocio</dt>
              <dd>{cliente.giro}</dd>
            </div>
            <div className="expediente-ficha__dato">
              <dt>Aviso de vencimiento</dt>
              <dd>{cliente.anticipacionAlertaDias} días antes</dd>
            </div>
            <div className="expediente-ficha__dato expediente-ficha__dato--completo">
              <dt>Dirección fiscal</dt>
              <dd>{cliente.direccionFiscal || '—'}</dd>
            </div>
            <div className="expediente-ficha__dato expediente-ficha__dato--completo">
              <dt>Contacto principal</dt>
              <dd>
                {contacto.nombre ? (
                  <>
                    <strong>{contacto.nombre}</strong>
                    {contacto.cargo ? ` · ${contacto.cargo}` : ''}
                    <span className="expediente-ficha__contacto">
                      {contacto.telefono ? <a href={`tel:${contacto.telefono.replace(/\s/g, '')}`}>{contacto.telefono}</a> : null}
                      {contacto.correo ? <a href={`mailto:${contacto.correo}`}>{contacto.correo}</a> : null}
                    </span>
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>
          <div className="expediente-ficha__numeracion" aria-label="Numeración correlativa">
            <div>
              <span className="expediente-ficha__etiqueta">Último informe</span>
              <span className="expediente-ficha__mono">{ultimos.INFORME ?? 'Sin emitir'}</span>
            </div>
            <div>
              <span className="expediente-ficha__etiqueta">Último reporte</span>
              <span className="expediente-ficha__mono">{ultimos.REPORTE ?? 'Sin emitir'}</span>
            </div>
            <div>
              <span className="expediente-ficha__etiqueta">Último servicio</span>
              <span className="expediente-ficha__mono">{cliente.ultimoServicio ? fechaCorta(cliente.ultimoServicio) : '—'}</span>
            </div>
          </div>
        </section>

        <div className="expediente-acciones">
          <Button variant="secondary" onClick={() => setVerApp(true)}>
            Vista del técnico (app)
          </Button>
          {puedeDarDeAlta ? (
            <Button variant="secondary" onClick={onNuevoProyecto}>
              Nueva sede
            </Button>
          ) : null}
        </div>

        <FoldPanel label={`Proyectos activos (${proyectosActivos.length})`} defaultOpen>
          {proyectosActivos.length === 0 ? (
            <p className="expediente-vacio">
              {puedeDarDeAlta
                ? 'Este cliente todavía no tiene sedes. Registre la primera con «Nueva sede».'
                : 'Este cliente todavía no tiene sedes activas.'}
            </p>
          ) : (
            <ul className="expediente-proyectos">
              {proyectosActivos.map((p) => (
                <li key={p.id} className="expediente-proyecto">
                  <div className="expediente-proyecto__cabecera">
                    <span className="expediente-proyecto__nombre">{p.nombre}</span>
                    <span className="expediente-proyecto__direccion">
                      {p.direccion}
                      {p.distrito ? `, ${p.distrito}` : ''}
                    </span>
                    {puedeDarDeAlta ? (
                      <button type="button" className="expediente-proyecto__agregar" onClick={() => onNuevoServicio(p.id)}>
                        + Servicio
                      </button>
                    ) : null}
                  </div>
                  {p.servicios.length === 0 ? (
                    <p className="expediente-proyecto__sin-servicios">Sin servicios contratados todavía.</p>
                  ) : (
                    <ul className="expediente-proyecto__servicios">
                      {p.servicios.map((s) => (
                        <li key={s.id}>
                          {s.tipo} <span className="expediente-proyecto__frecuencia">· {s.frecuencia}</span>
                          {s.requiereCertificado ? <span className="expediente-proyecto__frecuencia"> · con certificado</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </FoldPanel>

        {proyectosInactivos.length > 0 && (
          <FoldPanel label={`Proyectos inactivos (${proyectosInactivos.length})`}>
            <ul className="expediente-proyectos">
              {proyectosInactivos.map((p) => (
                <li key={p.id} className="expediente-proyecto expediente-proyecto--inactivo">
                  <div className="expediente-proyecto__cabecera">
                    <span className="expediente-proyecto__nombre">{p.nombre}</span>
                    <span className="expediente-proyecto__direccion">{p.direccion}</span>
                  </div>
                </li>
              ))}
            </ul>
          </FoldPanel>
        )}

        {programaRoedores ? (
          <FoldPanel label="Programa de control de roedores" defaultOpen={programaRoedores.estacionesRojo.length > 0}>
            <div className="expediente-roedores">
              {programaRoedores.estacionesRojo.length === 0 ? (
                <p className="expediente-vacio">Sin estaciones en rojo. El mapa y el historial por estación están en el Mapa Murino.</p>
              ) : (
                <ul className="expediente-roedores__lista">
                  {programaRoedores.estacionesRojo.map((e) => (
                    <li key={`${e.proyecto}-${e.plano}-${e.estacion}`}>
                      <Badge color="ROJO">Rojo</Badge>
                      <span className="expediente-ficha__mono">
                        {e.proyecto} · {e.plano} · E-{String(e.estacion).padStart(2, '0')}
                      </span>
                      <span className="expediente-proyecto__frecuencia">{e.visitasConsecutivas} visitas seguidas con consumo</span>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="secondary" onClick={onAbrirMapaMurino}>
                Abrir Mapa Murino
              </Button>
            </div>
          </FoldPanel>
        ) : null}

        <FoldPanel label="Historial de servicios por proyecto">
          {porProyecto.length === 0 ? (
            <p className="expediente-vacio">Sin servicios ejecutados todavía.</p>
          ) : (
            porProyecto.map(({ proyecto, servicios }) => (
              <div key={proyecto} className="expediente-historial__grupo">
                <h3 className="expediente-historial__titulo">
                  {proyecto} <span className="expediente-proyecto__frecuencia">· {servicios.length} servicios</span>
                </h3>
                <ul className="expediente-historial">
                  {servicios.map((h, i) => (
                    <li key={h.id}>
                      <div className="expediente-historial__fila">
                        <span className="expediente-historial__fecha tabular">{fechaCorta(h.fecha)}</span>
                        <span className="expediente-historial__tipo">{h.tipo}</span>
                        <span className="expediente-historial__tecnico">{h.tecnico ?? '—'}</span>
                        <span className="expediente-historial__doc">{codigoDe.get(h.id) ?? ''}</span>
                      </div>
                      {i < servicios.length - 1 && <PerforatedDivider />}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </FoldPanel>

        <FoldPanel label={`Carpeta de PDF (${carpeta.length})`}>
          {carpeta.length === 0 ? (
            <p className="expediente-vacio">Todavía no hay documentos aprobados para este cliente.</p>
          ) : (
            agruparPorRuta(carpeta).map(([ruta, pdfs]) => (
              <div key={ruta} className="expediente-carpeta">
                <h3 className="expediente-carpeta__ruta">{ruta}</h3>
                <ul className="expediente-pdfs">
                  {pdfs.map((f) => (
                    <li key={f.nombre} className="expediente-pdf">
                      <span className="expediente-pdf__nombre">{f.nombre}</span>
                      <span className="expediente-pdf__ruta">{fechaCorta(f.fecha)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </FoldPanel>
      </div>

      {verApp ? <VistaTecnicoApp cliente={cliente} sedes={vistaApp.sedes} tecnico={vistaApp.tecnico} onCerrar={() => setVerApp(false)} /> : null}
    </div>
  );
}
