import { useEffect, useRef, useState } from 'react';
import type { ClienteFila } from '../model/clientes-mock';
import type { SedeTecnico } from '../model/vista-tecnico';
import './vista-tecnico-app.css';

interface Props {
  cliente: ClienteFila;
  sedes: SedeTecnico[];
  tecnico: string;
  onCerrar: () => void;
}

type Pantalla = { tipo: 'cliente' } | { tipo: 'sede'; sedeId: string } | { tipo: 'servicio'; sedeId: string; servicioId: string };

const fechaCorta = (f: string) => new Date(`${f}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });

const NO_VE = [
  'RUC, dirección fiscal y giro',
  'Numeración correlativa y carpeta de PDF',
  'Vencimiento de certificados',
  'Sedes inactivas',
  'Edición de la ficha, sedes y servicios',
];

/**
 * Maqueta de la app Android del técnico (C10, C11) para revisarla desde la
 * web. No es una vista del rol en la web: el técnico no tiene acceso a ella.
 */
export function VistaTecnicoApp({ cliente, sedes, tecnico, onCerrar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [pantalla, setPantalla] = useState<Pantalla>({ tipo: 'cliente' });

  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
  }, []);

  const sede = pantalla.tipo !== 'cliente' ? sedes.find((s) => s.id === pantalla.sedeId) : undefined;
  const servicio = pantalla.tipo === 'servicio' ? sede?.servicios.find((s) => s.id === pantalla.servicioId) : undefined;

  function atras() {
    if (pantalla.tipo === 'servicio') setPantalla({ tipo: 'sede', sedeId: pantalla.sedeId });
    else setPantalla({ tipo: 'cliente' });
  }

  const titulo = servicio ? servicio.tipoId : sede ? sede.nombre : cliente.codigoCorto;

  return (
    <dialog ref={dialogo} className="vta" aria-labelledby="vta-titulo" onClose={onCerrar} onCancel={onCerrar}>
      <div className="vta__contenido">
        <aside className="vta__notas">
          <p className="vta__kicker">Maqueta · app Android</p>
          <h2 id="vta-titulo" className="vta__titulo">
            Vista del técnico operador
          </h2>
          <p className="vta__texto">
            Así ve a <strong>{cliente.razonSocial}</strong> un técnico en la app. Puede atender cualquier sede activa, aunque no sea
            el titular de la visita (§3, §8.2).
          </p>
          <p className="vta__subtitulo">No ve en la app</p>
          <ul className="vta__lista">
            {NO_VE.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <button type="button" className="vta__cerrar" onClick={() => dialogo.current?.close()}>
            Cerrar vista previa
          </button>
        </aside>

        <div className="vta__telefono" aria-label="Pantalla de la app del técnico">
          <div className="vta__estado" aria-hidden="true">
            <span>9:41</span>
            <span>●●● 4G ▮</span>
          </div>
          <header className="vta__barra">
            {pantalla.tipo !== 'cliente' ? (
              <button type="button" className="vta__atras" onClick={atras} aria-label="Atrás">
                ←
              </button>
            ) : null}
            <div>
              <p className="vta__barra-titulo">{titulo}</p>
              <p className="vta__barra-sub">{tecnico}</p>
            </div>
          </header>

          <div className="vta__pantalla">
            {pantalla.tipo === 'cliente' && (
              <>
                <section className="vta__tarjeta">
                  <p className="vta__etiqueta">Cliente</p>
                  <p className="vta__fuerte">{cliente.razonSocial}</p>
                  <p className="vta__etiqueta vta__etiqueta--sep">Responsable en planta (firma)</p>
                  {cliente.contacto.nombre ? (
                    <>
                      <p className="vta__fuerte">{cliente.contacto.nombre}</p>
                      <p className="vta__suave">{cliente.contacto.cargo}</p>
                      {cliente.contacto.telefono ? (
                        <a className="vta__llamar" href={`tel:${cliente.contacto.telefono.replace(/\s/g, '')}`}>
                          Llamar · {cliente.contacto.telefono}
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <p className="vta__suave">Sin contacto registrado.</p>
                  )}
                </section>

                <p className="vta__seccion">Sedes activas ({sedes.length})</p>
                {sedes.length === 0 ? (
                  <p className="vta__suave vta__vacio">
                    {cliente.estado === 'ACTIVO' ? 'Este cliente todavía no tiene sedes activas.' : 'Cliente inactivo: no aparece en la app.'}
                  </p>
                ) : (
                  <ul className="vta__opciones">
                    {sedes.map((s) => (
                      <li key={s.id}>
                        <button type="button" className="vta__opcion" onClick={() => setPantalla({ tipo: 'sede', sedeId: s.id })}>
                          <span className="vta__fuerte vta__mono">{s.nombre}</span>
                          <span className="vta__suave">{s.direccion}</span>
                          <span className="vta__chips">
                            {s.visitasHoy.map((v) => (
                              <span key={v.id} className="vta__chip vta__chip--hoy">
                                Hoy {v.hora}
                              </span>
                            ))}
                            {s.estacionesRojo.length > 0 ? (
                              <span className="vta__chip vta__chip--rojo">{s.estacionesRojo.length} estaciones en rojo</span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="vta__pie">¿Encontró un cliente que no está en la lista? Repórtelo al Administrador.</p>
              </>
            )}

            {pantalla.tipo === 'sede' && sede && (
              <>
                <p className="vta__suave">{sede.direccion}</p>
                <p className="vta__seccion">Servicios contratados</p>
                {sede.servicios.length === 0 ? (
                  <p className="vta__suave vta__vacio">Sin servicios contratados.</p>
                ) : (
                  <ul className="vta__opciones">
                    {sede.servicios.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="vta__opcion"
                          onClick={() => setPantalla({ tipo: 'servicio', sedeId: sede.id, servicioId: s.id })}
                        >
                          <span className="vta__fuerte">{s.tipo}</span>
                          <span className="vta__suave">
                            {s.frecuencia} ·{' '}
                            {s.ultimaVisita
                              ? `última: ${fechaCorta(s.ultimaVisita.fecha)}${s.ultimaVisita.tecnico ? ` (${s.ultimaVisita.tecnico})` : ''}`
                              : 'sin visitas'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {pantalla.tipo === 'servicio' && sede && servicio && (
              <>
                <p className="vta__fuerte">{servicio.tipo}</p>
                <p className="vta__suave">
                  {sede.nombre} · {servicio.frecuencia}
                </p>

                <p className="vta__seccion">Insumos autorizados</p>
                <ul className="vta__items">
                  {servicio.insumos.map((i) => (
                    <li key={i.nombre}>
                      <span className="vta__fuerte">{i.nombre}</span>
                      <span className="vta__suave">
                        Dosis: {i.dosis} · {i.registroDigesa}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="vta__seccion">Equipos</p>
                <ul className="vta__items">
                  {servicio.equipos.map((e) => (
                    <li key={e.codigo}>
                      <span className="vta__fuerte">
                        {e.nombre} <span className="vta__mono vta__suave">{e.codigo}</span>
                      </span>
                      {e.operativo ? null : <span className="vta__chip vta__chip--rojo">No operativo</span>}
                    </li>
                  ))}
                </ul>

                {servicio.tipoId === 'DRT' ? (
                  <>
                    <p className="vta__seccion">Estaciones a revisar primero</p>
                    {sede.estacionesRojo.length === 0 ? (
                      <p className="vta__suave">Ninguna estación en rojo.</p>
                    ) : (
                      <ul className="vta__items">
                        {sede.estacionesRojo.map((e) => (
                          <li key={`${e.plano}-${e.estacion}`}>
                            <span className="vta__fuerte vta__mono">
                              E-{String(e.estacion).padStart(2, '0')} · {e.plano}
                            </span>
                            <span className="vta__chip vta__chip--rojo">{e.visitasConsecutivas} visitas con consumo</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : null}

                <div className="vta__accion">
                  <button type="button" className="vta__iniciar" disabled>
                    Iniciar servicio
                  </button>
                  <p className="vta__pie">En la app abre el formulario de campo con estos datos precargados.</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
