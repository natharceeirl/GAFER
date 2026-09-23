import { useState, type ChangeEvent } from 'react';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { StateStamp } from '../../../shared/ui/molecules/StateStamp';
import { Button } from '../../../shared/ui/atoms/Button';
import { Bloque, Campo, Chips, Opciones, ariaError } from '../../../shared/ui/molecules/FormFields';
import { FirmaCanvas } from '../components/FirmaCanvas';
import {
  ESTADOS_GENERALES,
  METODOS_APLICACION,
  NIVELES_INFESTACION,
  UNIDADES,
  cerrarFormulario,
  registrarGuardado,
  validarCierre,
  type BloqueCierre,
  type FormularioCampo,
  type InsumoAplicado,
} from '../model/formulario-campo';
import type { Equipo, Insumo, PersonalOperativo } from '../../mantenimiento/model/tipos';
import './formulario-campo-page.css';

export interface CatalogosCampo {
  hallazgos: string[];
  acciones: string[];
  observaciones: string[];
  recomendaciones: string[];
}

interface Props {
  formulario: FormularioCampo;
  usuario: string;
  dosisAutorizada: Record<string, string>;
  personal: PersonalOperativo[];
  insumos: Insumo[];
  equipos: Equipo[];
  catalogos: CatalogosCampo;
  onGuardar: (f: FormularioCampo) => void;
  onCerrar: (f: FormularioCampo) => void;
  onVolver: () => void;
  onAbrirMapaMurino: () => void;
}

const NOMBRE_BLOQUE: Record<BloqueCierre, string> = {
  personal: 'Personal',
  equipos: 'Herramientas y equipos',
  insumos: 'Insumos aplicados',
  metodos: 'Método de aplicación',
  condiciones: 'Condiciones ambientales',
  diagnostico: 'Diagnóstico y hallazgos',
  conformidad: 'Conformidad del cliente',
  certificado: 'Certificado',
};

function ahora(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/**
 * Formulario de campo (§4, §8.2). Se puede guardar como borrador en
 * cualquier momento; el cierre exige los bloques obligatorios, bloquea el
 * ingreso para todos y envía el documento a revisión (§8.3).
 */
export function FormularioCampoPage({
  formulario,
  usuario,
  dosisAutorizada,
  personal,
  insumos,
  equipos,
  catalogos,
  onGuardar,
  onCerrar,
  onVolver,
  onAbrirMapaMurino,
}: Props) {
  const [f, setF] = useState<FormularioCampo>(formulario);
  const [sucio, setSucio] = useState(false);
  const [intentoCierre, setIntentoCierre] = useState(false);
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cerrado = f.estado !== 'BORRADOR';
  const errores = intentoCierre && !cerrado ? validarCierre(f) : {};
  const bloquesConError = Object.keys(errores) as BloqueCierre[];
  const ultimoGuardado = f.guardados.at(-1);

  function cambiar<K extends keyof FormularioCampo>(campo: K, valor: FormularioCampo[K]) {
    setF((prev) => ({ ...prev, [campo]: valor }));
    setSucio(true);
    setAviso(null);
  }

  function cambiarInsumo(insumoId: string, cambio: Partial<InsumoAplicado>) {
    cambiar(
      'insumos',
      f.insumos.map((i) => (i.insumoId === insumoId ? { ...i, ...cambio } : i)),
    );
  }

  function guardarBorrador() {
    const guardado = registrarGuardado(f, usuario, ahora());
    setF(guardado);
    onGuardar(guardado);
    setSucio(false);
    setAviso(`Borrador guardado a las ${guardado.guardados.at(-1)?.fechaHora.slice(11)}.`);
  }

  function pedirCierre() {
    setIntentoCierre(true);
    if (Object.keys(validarCierre(f)).length > 0) {
      setConfirmandoCierre(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setConfirmandoCierre(true);
  }

  function confirmarCierre() {
    const cerradoYEnviado = cerrarFormulario(f, usuario, ahora());
    setF(cerradoYEnviado);
    setSucio(false);
    setConfirmandoCierre(false);
    onCerrar(cerradoYEnviado);
  }

  function volver() {
    if (sucio && !cerrado) {
      setConfirmandoSalida(true);
      return;
    }
    onVolver();
  }

  function agregarFotos(e: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    const nuevas = archivos.map((a, i) => ({ id: `${Date.now()}-${i}`, nombre: a.name, url: URL.createObjectURL(a) }));
    cambiar('fotos', [...f.fotos, ...nuevas]);
    e.target.value = '';
  }

  const personalActivo = personal.filter((p) => p.estado === 'ACTIVO');
  const personalDisponible = personalActivo.filter((p) => !f.personal.includes(p.id));

  return (
    <div className="campo-page">
      <TicketHeader
        code={`${f.clienteCodigo} · ${f.proyectoNombre} · ${f.tipoServicio} · ${f.fecha}`}
        title="Formulario de campo"
        meta={
          ultimoGuardado
            ? `${f.servicioEtiqueta} · último movimiento: ${ultimoGuardado.accion.toLowerCase()} por ${ultimoGuardado.usuario}, ${ultimoGuardado.fechaHora.slice(11)}`
            : `${f.servicioEtiqueta} · sin guardar todavía`
        }
        action={
          <button type="button" className="campo-page__volver" onClick={volver}>
            ← Servicios de campo
          </button>
        }
      />

      <div className="campo-page__cuerpo">
        <div className="campo-page__estado">
          <StateStamp estado={f.estado} animate={false} />
          {cerrado ? (
            <p>Inspección cerrada: nadie puede ingresar más datos. Solo el Supervisor puede intervenir con su clave (§8.2).</p>
          ) : (
            <p>Puede guardar como borrador en cualquier momento; otros técnicos pueden completar este mismo formulario (§8.2).</p>
          )}
        </div>

        {confirmandoSalida ? (
          <div className="campo-page__salida" role="alert">
            <p>Hay cambios sin guardar en este formulario.</p>
            <div>
              <Button variant="secondary" onClick={() => setConfirmandoSalida(false)}>
                Seguir editando
              </Button>
              <Button variant="secondary" onClick={onVolver}>
                Salir sin guardar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  guardarBorrador();
                  onVolver();
                }}
              >
                Guardar y salir
              </Button>
            </div>
          </div>
        ) : null}

        {bloquesConError.length > 0 ? (
          <div className="campo-page__faltantes" role="alert">
            <strong>
              No se puede cerrar todavía: {bloquesConError.length === 1 ? 'falta 1 bloque' : `faltan ${bloquesConError.length} bloques`}.
            </strong>
            <span>{bloquesConError.map((b) => NOMBRE_BLOQUE[b]).join(' · ')}</span>
          </div>
        ) : null}

        <fieldset className="campo-page__form" disabled={cerrado}>
          <Bloque titulo="Identificación">
            <div className="ff-campo">
              <span className="ff-campo__label">Cliente</span>
              <span className="campo-page__dato">
                {f.clienteRazon} <span className="campo-page__codigo">{f.clienteCodigo}</span>
              </span>
            </div>
            <div className="ff-campo">
              <span className="ff-campo__label">Proyecto · servicio</span>
              <span className="campo-page__dato">
                <span className="campo-page__codigo">{f.proyectoNombre}</span> · {f.servicioEtiqueta}
              </span>
            </div>
            <Campo id="cf-fecha" label="Fecha">
              <input id="cf-fecha" type="date" value={f.fecha} onChange={(e) => cambiar('fecha', e.target.value)} />
            </Campo>
            <Campo id="cf-hora" label="Hora">
              <input id="cf-hora" type="time" value={f.hora} onChange={(e) => cambiar('hora', e.target.value)} />
            </Campo>
          </Bloque>

          <Bloque titulo="Personal" error={errores.personal}>
            <ul className="campo-personal">
              {f.personal.map((id) => {
                const p = personal.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <li key={id}>
                    <span className="campo-personal__nombre">{p.nombre}</span>
                    <span className="campo-personal__detalle">
                      {p.cargo} · DNI {p.dni}
                    </span>
                    <button
                      type="button"
                      className="campo-personal__quitar"
                      onClick={() => cambiar('personal', f.personal.filter((x) => x !== id))}
                      aria-label={`Quitar a ${p.nombre}`}
                    >
                      Quitar
                    </button>
                  </li>
                );
              })}
            </ul>
            {personalDisponible.length > 0 ? (
              <Campo id="cf-personal" label="Agregar persona que intervino">
                <select
                  id="cf-personal"
                  value=""
                  onChange={(e) => e.target.value && cambiar('personal', [...f.personal, e.target.value])}
                >
                  <option value="">Seleccione del personal activo…</option>
                  {personalDisponible.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — {p.cargo}
                    </option>
                  ))}
                </select>
              </Campo>
            ) : null}
          </Bloque>

          <Bloque titulo="Herramientas y equipos" error={errores.equipos}>
            <ul className="ff-checks ff-campo--completo">
              {equipos.map((eq) => {
                const fuera = eq.estadoOperativo === 'FUERA_DE_SERVICIO';
                return (
                  <li key={eq.id} className={fuera ? 'ff-check ff-check--deshabilitado' : 'ff-check'}>
                    <input
                      type="checkbox"
                      id={`cf-equipo-${eq.id}`}
                      checked={f.equipos.includes(eq.id)}
                      disabled={fuera}
                      onChange={() =>
                        cambiar('equipos', f.equipos.includes(eq.id) ? f.equipos.filter((x) => x !== eq.id) : [...f.equipos, eq.id])
                      }
                    />
                    <label htmlFor={`cf-equipo-${eq.id}`} className="ff-check__nombre">
                      {eq.nombre}
                    </label>
                    <span className="ff-check__detalle">
                      {eq.codigoInterno} · {eq.tipo}
                      {fuera ? ' · fuera de servicio' : ''}
                      {formulario.equipos.includes(eq.id) ? ' · asignado al servicio' : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Bloque>

          <Bloque titulo="Insumos aplicados" error={errores.insumos}>
            {f.insumos.length === 0 ? (
              <p className="campo-page__vacio ff-campo--completo">Este servicio no tiene insumos autorizados.</p>
            ) : (
              <ul className="campo-insumos ff-campo--completo">
                {f.insumos.map((i) => {
                  const cat = insumos.find((c) => c.id === i.insumoId);
                  const base = `cf-insumo-${i.insumoId}`;
                  return (
                    <li key={i.insumoId} className={i.aplicado ? 'campo-insumo' : 'campo-insumo campo-insumo--no-aplicado'}>
                      <div className="campo-insumo__cabecera">
                        <input
                          type="checkbox"
                          id={`${base}-aplicado`}
                          checked={i.aplicado}
                          onChange={() => cambiarInsumo(i.insumoId, { aplicado: !i.aplicado })}
                        />
                        <label htmlFor={`${base}-aplicado`} className="campo-insumo__nombre">
                          {cat?.nombre ?? i.insumoId}
                        </label>
                        <span className="campo-insumo__ref">
                          N° DIGESA {cat?.registroDigesa} · {cat?.concentracion} · dosis autorizada: {dosisAutorizada[i.insumoId] ?? cat?.dosisReferencial}
                        </span>
                      </div>
                      {i.aplicado ? (
                        <div className="campo-insumo__campos">
                          <Campo id={`${base}-lote`} label="Lote">
                            <input
                              id={`${base}-lote`}
                              type="text"
                              className="ff-campo__mono"
                              value={i.lote}
                              onChange={(e) => cambiarInsumo(i.insumoId, { lote: e.target.value.toUpperCase() })}
                              placeholder="L-2451"
                            />
                          </Campo>
                          <Campo id={`${base}-vencimiento`} label="Vencimiento">
                            <input
                              id={`${base}-vencimiento`}
                              type="date"
                              value={i.vencimiento}
                              onChange={(e) => cambiarInsumo(i.insumoId, { vencimiento: e.target.value })}
                            />
                          </Campo>
                          <Campo id={`${base}-cantidad`} label="Cantidad">
                            <div className="campo-insumo__cantidad">
                              <input
                                id={`${base}-cantidad`}
                                type="number"
                                min={0}
                                inputMode="decimal"
                                value={i.cantidad}
                                onChange={(e) => cambiarInsumo(i.insumoId, { cantidad: e.target.value })}
                                placeholder="0"
                              />
                              <select
                                aria-label="Unidad"
                                value={i.unidad}
                                onChange={(e) => cambiarInsumo(i.insumoId, { unidad: e.target.value })}
                              >
                                {UNIDADES.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </Campo>
                          <Campo id={`${base}-zonas`} label="Zonas tratadas">
                            <input
                              id={`${base}-zonas`}
                              type="text"
                              value={i.zonas}
                              onChange={(e) => cambiarInsumo(i.insumoId, { zonas: e.target.value })}
                              placeholder="Perímetro, almacén de insumos"
                            />
                          </Campo>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Bloque>

          <Bloque titulo="Método de aplicación" error={errores.metodos}>
            <Chips etiqueta="Métodos usados en esta visita" opciones={METODOS_APLICACION} seleccion={f.metodos} onCambiar={(v) => cambiar('metodos', v)} />
          </Bloque>

          <Bloque titulo="Condiciones ambientales" error={errores.condiciones}>
            <Campo id="cf-temperatura" label="Temperatura">
              <div className="ff-sufijo">
                <input
                  {...ariaError('cf-temperatura')}
                  type="number"
                  inputMode="decimal"
                  value={f.temperatura}
                  onChange={(e) => cambiar('temperatura', e.target.value)}
                  placeholder="21"
                />
                <span>°C</span>
              </div>
            </Campo>
            <Campo id="cf-humedad" label="Humedad">
              <div className="ff-sufijo">
                <input
                  {...ariaError('cf-humedad')}
                  type="number"
                  min={0}
                  max={100}
                  inputMode="decimal"
                  value={f.humedad}
                  onChange={(e) => cambiar('humedad', e.target.value)}
                  placeholder="38"
                />
                <span>%</span>
              </div>
            </Campo>
            <Campo id="cf-viento" label="Viento">
              <div className="ff-sufijo">
                <input
                  {...ariaError('cf-viento')}
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={f.viento}
                  onChange={(e) => cambiar('viento', e.target.value)}
                  placeholder="8"
                />
                <span>km/h</span>
              </div>
            </Campo>
          </Bloque>

          <Bloque titulo="Diagnóstico y hallazgos" error={errores.diagnostico}>
            <Opciones
              nombre="Estado general"
              valor={f.estadoGeneral || null}
              opciones={ESTADOS_GENERALES.map((v) => ({ valor: v, etiqueta: v }))}
              onCambiar={(v) => cambiar('estadoGeneral', v)}
            />
            <Opciones
              nombre="Nivel de infestación"
              valor={f.nivelInfestacion || null}
              opciones={NIVELES_INFESTACION.map((v) => ({ valor: v, etiqueta: v }))}
              onCambiar={(v) => cambiar('nivelInfestacion', v)}
            />
            <Chips etiqueta="Hallazgos" opciones={catalogos.hallazgos} seleccion={f.hallazgos} onCambiar={(v) => cambiar('hallazgos', v)} />
            <Campo id="cf-hallazgos" label="Hallazgos por zona (opcional)" ancho="completo">
              <textarea
                id="cf-hallazgos"
                value={f.hallazgosDetalle}
                onChange={(e) => cambiar('hallazgosDetalle', e.target.value)}
                placeholder="Almacén: excretas frescas junto a parihuelas del sector B."
              />
            </Campo>
          </Bloque>

          {f.tipoServicio === 'DRT' ? (
            <Bloque titulo="Inspección de estaciones">
              <div className="campo-page__mapa ff-campo--completo">
                <p>
                  Registre cada estación en el Mapa Murino: tipo de cebo, gramos, lote, consumo y estado físico (§5.1). El ícono y el aura
                  se calculan solos.
                </p>
                <Button type="button" variant="secondary" onClick={onAbrirMapaMurino}>
                  Abrir Mapa Murino
                </Button>
              </div>
            </Bloque>
          ) : null}

          <Bloque titulo="Acciones correctivas">
            <Chips etiqueta="Acciones ejecutadas" opciones={catalogos.acciones} seleccion={f.acciones} onCambiar={(v) => cambiar('acciones', v)} />
          </Bloque>

          <Bloque titulo="Observaciones técnicas">
            <Chips
              etiqueta="Observaciones del catálogo"
              opciones={catalogos.observaciones}
              seleccion={f.observaciones}
              onCambiar={(v) => cambiar('observaciones', v)}
            />
            <Campo id="cf-observaciones" label="Otras observaciones (opcional)" ancho="completo">
              <textarea
                id="cf-observaciones"
                value={f.observacionesLibre}
                onChange={(e) => cambiar('observacionesLibre', e.target.value)}
                placeholder="Acceso a la zona de tanques restringido por mantenimiento."
              />
            </Campo>
          </Bloque>

          <Bloque titulo="Recomendaciones">
            <Chips
              etiqueta="Acciones que el cliente debe realizar antes de la próxima visita"
              opciones={catalogos.recomendaciones}
              seleccion={f.recomendaciones}
              onCambiar={(v) => cambiar('recomendaciones', v)}
            />
          </Bloque>

          <Bloque titulo="Fotografías">
            <div className="ff-campo ff-campo--completo">
              <label htmlFor="cf-fotos" className="campo-fotos__boton">
                Tomar o elegir fotos
              </label>
              <input id="cf-fotos" className="campo-fotos__input" type="file" accept="image/*" capture="environment" multiple onChange={agregarFotos} />
              <span className="ff-campo__ayuda">El Supervisor elige hasta 20 para el PDF; se comprimen solas (§4).</span>
            </div>
            {f.fotos.length > 0 ? (
              <ul className="campo-fotos ff-campo--completo">
                {f.fotos.map((foto) => (
                  <li key={foto.id}>
                    <img src={foto.url} alt={foto.nombre} />
                    <button
                      type="button"
                      onClick={() => cambiar('fotos', f.fotos.filter((x) => x.id !== foto.id))}
                      aria-label={`Quitar ${foto.nombre}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Bloque>

          <Bloque titulo="Conformidad del cliente" error={errores.conformidad}>
            <label className="campo-page__no-disponible ff-campo--completo">
              <input
                type="checkbox"
                checked={f.responsableNoDisponible}
                onChange={(e) => cambiar('responsableNoDisponible', e.target.checked)}
              />
              Responsable no disponible al momento del servicio
            </label>
            {!f.responsableNoDisponible ? (
              <>
                <div className="ff-campo ff-campo--completo">
                  <span className="ff-campo__label">Firma del responsable</span>
                  <FirmaCanvas valor={f.firma} onCambiar={(v) => cambiar('firma', v)} deshabilitado={cerrado} />
                </div>
                <Campo id="cf-firmante-nombre" label="Nombre completo del firmante" ayuda="Puede cambiar en cada visita.">
                  <input
                    id="cf-firmante-nombre"
                    type="text"
                    value={f.firmanteNombre}
                    onChange={(e) => cambiar('firmanteNombre', e.target.value)}
                    placeholder="Rosa Contreras"
                  />
                </Campo>
                <Campo id="cf-firmante-cargo" label="Cargo del firmante">
                  <input
                    id="cf-firmante-cargo"
                    type="text"
                    value={f.firmanteCargo}
                    onChange={(e) => cambiar('firmanteCargo', e.target.value)}
                    placeholder="Jefa de Planta"
                  />
                </Campo>
              </>
            ) : null}
          </Bloque>

          {f.requiereCertificado ? (
            <Bloque titulo="Certificado" error={errores.certificado}>
              <Campo id="cf-cert-numero" label="N° de certificado" ancho="completo">
                <input
                  id="cf-cert-numero"
                  type="text"
                  className="ff-campo__mono"
                  value={f.certificadoNumero}
                  onChange={(e) => cambiar('certificadoNumero', e.target.value.toUpperCase())}
                  placeholder={`CERT-${f.clienteCodigo}-015-${f.fecha.slice(0, 4)}`}
                />
              </Campo>
              <Campo id="cf-cert-emision" label="Fecha de emisión">
                <input
                  id="cf-cert-emision"
                  type="date"
                  value={f.certificadoEmision}
                  onChange={(e) => cambiar('certificadoEmision', e.target.value)}
                />
              </Campo>
              <Campo id="cf-cert-vencimiento" label="Fecha de vencimiento">
                <input
                  id="cf-cert-vencimiento"
                  type="date"
                  value={f.certificadoVencimiento}
                  onChange={(e) => cambiar('certificadoVencimiento', e.target.value)}
                />
              </Campo>
            </Bloque>
          ) : null}
        </fieldset>

        <section className="campo-historial" aria-labelledby="campo-historial-t">
          <h2 id="campo-historial-t">Registro de guardados</h2>
          {f.guardados.length === 0 ? (
            <p className="campo-page__vacio">Todavía no se guardó. Cada guardado queda con el nombre del técnico, fecha y hora (§8.2).</p>
          ) : (
            <ol>
              {f.guardados.map((g, i) => (
                <li key={i}>
                  <span className="campo-historial__hora">{g.fechaHora}</span>
                  <span>{g.accion}</span>
                  <span className="campo-historial__usuario">{g.usuario}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {!cerrado ? (
        <div className="campo-barra">
          {confirmandoCierre ? (
            <div className="campo-barra__confirmar" role="alert">
              <p>El cierre bloquea el ingreso de datos para todos los técnicos y envía el documento a revisión.</p>
              <div>
                <Button variant="secondary" onClick={() => setConfirmandoCierre(false)}>
                  Volver al formulario
                </Button>
                <Button variant="primary" onClick={confirmarCierre}>
                  Confirmar cierre
                </Button>
              </div>
            </div>
          ) : (
            <>
              <span className="campo-barra__estado" role="status">
                {aviso ?? (sucio ? 'Cambios sin guardar' : 'Sin cambios pendientes')}
              </span>
              <div className="campo-barra__botones">
                <Button variant="secondary" onClick={guardarBorrador}>
                  Guardar borrador
                </Button>
                <Button variant="primary" onClick={pedirCierre}>
                  Cerrar inspección
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
