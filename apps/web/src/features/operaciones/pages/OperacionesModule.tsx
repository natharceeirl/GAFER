import { useState } from 'react';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { PerforatedDivider } from '../../../shared/ui/molecules/PerforatedDivider';
import { Badge } from '../../../shared/ui/atoms/Badge';
import { Button } from '../../../shared/ui/atoms/Button';
import { FormularioCampoPage, type CatalogosCampo } from './FormularioCampoPage';
import { useCartera } from '../../cliente-expediente/model/cartera-context';
import { proyectosDe, sedesActivas } from '../../cliente-expediente/model/cartera';
import { useOperaciones } from '../model/operaciones-context';
import { PROGRAMACION_HOY } from '../model/programacion-mock';
import { aDocumento, crearFormulario, personalDeUsuario, type FormularioCampo } from '../model/formulario-campo';
import { CATALOGOS_TEXTO_MOCK, EQUIPOS_MOCK, INSUMOS_MOCK, PERSONAL_MOCK } from '../../mantenimiento/model/mantenimiento-mock';
import type { ColorAura } from '@gafer/contracts';
import './operaciones-module.css';

interface Props {
  usuario: string;
  onAbrirMapaMurino: () => void;
}

function itemsDe(id: string) {
  return CATALOGOS_TEXTO_MOCK.find((c) => c.id === id)?.items ?? [];
}

const CATALOGOS: CatalogosCampo = {
  hallazgos: itemsDe('hallazgos'),
  acciones: itemsDe('acciones-correctivas'),
  observaciones: itemsDe('observaciones'),
  recomendaciones: itemsDe('recomendaciones'),
};

function hoy(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

const ESTADO_VISUAL: Record<'SIN_INICIAR' | FormularioCampo['estado'], { etiqueta: string; color: ColorAura }> = {
  SIN_INICIAR: { etiqueta: 'Sin iniciar', color: 'SIN_COLOR' },
  BORRADOR: { etiqueta: 'Borrador', color: 'AMARILLO' },
  ENVIADO_A_REVISION: { etiqueta: 'En revisión', color: 'VERDE' },
};

/**
 * Operaciones de campo (§8). Cualquier técnico activo atiende cualquier
 * proyecto activo, sin asignación restrictiva (§3, §8.2).
 */
export function OperacionesModule({ usuario, onAbrirMapaMurino }: Props) {
  const { cartera } = useCartera();
  const { formularios, guardarFormulario, enviarARevision } = useOperaciones();
  const [abierto, setAbierto] = useState<FormularioCampo | null>(null);
  const [sedeElegida, setSedeElegida] = useState('');
  const [servicioElegido, setServicioElegido] = useState('');
  const fecha = hoy();

  function idFormulario(clienteId: string, proyectoId: string, servicioId: string) {
    return `${clienteId}__${proyectoId}__${servicioId}__${fecha}`;
  }

  function ubicar(clienteId: string, proyectoId: string, servicioId: string) {
    const cliente = cartera.clientes.find((c) => c.id === clienteId);
    const proyecto = cliente ? proyectosDe(cartera, clienteId).find((p) => p.id === proyectoId) : undefined;
    const servicio = proyecto?.servicios.find((s) => s.id === servicioId);
    return cliente && proyecto && servicio ? { cliente, proyecto, servicio } : null;
  }

  function abrir(clienteId: string, proyectoId: string, servicioId: string, hora: string) {
    const existente = formularios[idFormulario(clienteId, proyectoId, servicioId)];
    if (existente) {
      setAbierto(existente);
      return;
    }
    const ref = ubicar(clienteId, proyectoId, servicioId);
    if (!ref) return;
    const yo = personalDeUsuario(usuario, PERSONAL_MOCK);
    setAbierto(
      crearFormulario({
        cliente: ref.cliente,
        proyecto: ref.proyecto,
        servicio: ref.servicio,
        fecha,
        hora,
        personalInicial: yo ? [yo.id] : [],
      }),
    );
  }

  if (abierto) {
    const ref = ubicar(abierto.clienteId, abierto.proyectoId, abierto.servicioId);
    return (
      <FormularioCampoPage
        key={abierto.id}
        formulario={abierto}
        usuario={usuario}
        dosisAutorizada={ref?.servicio.dosis ?? {}}
        personal={PERSONAL_MOCK}
        insumos={INSUMOS_MOCK}
        equipos={EQUIPOS_MOCK}
        catalogos={CATALOGOS}
        onGuardar={guardarFormulario}
        onCerrar={(f) => enviarARevision(f, aDocumento(f, { personal: PERSONAL_MOCK, insumos: INSUMOS_MOCK }))}
        onVolver={() => setAbierto(null)}
        onAbrirMapaMurino={onAbrirMapaMurino}
      />
    );
  }

  const programadas = PROGRAMACION_HOY.map((v) => ({ visita: v, ref: ubicar(v.clienteId, v.proyectoId, v.servicioId) })).filter(
    (x): x is { visita: (typeof PROGRAMACION_HOY)[number]; ref: NonNullable<ReturnType<typeof ubicar>> } => x.ref !== null,
  );
  const idsProgramados = new Set(programadas.map((x) => idFormulario(x.visita.clienteId, x.visita.proyectoId, x.visita.servicioId)));
  const otros = Object.values(formularios).filter((f) => f.fecha === fecha && !idsProgramados.has(f.id));

  const sedes = sedesActivas(cartera);
  const sede = sedes.find((s) => `${s.cliente.id}::${s.proyecto.id}` === sedeElegida);
  const serviciosDeSede = sede?.proyecto.servicios ?? [];

  function estadoDe(id: string) {
    return ESTADO_VISUAL[formularios[id]?.estado ?? 'SIN_INICIAR'];
  }

  function textoBoton(id: string) {
    const f = formularios[id];
    if (!f) return 'Abrir formulario';
    return f.estado === 'BORRADOR' ? 'Continuar' : 'Ver formulario';
  }

  return (
    <div className="ops-page">
      <TicketHeader
        code={fecha}
        title="Servicios de campo"
        meta="Programación del día · cualquier técnico activo puede atender cualquier proyecto activo"
      />

      <div className="ops-page__cuerpo">
        <section aria-labelledby="ops-programados">
          <h2 id="ops-programados" className="ops-titulo">
            Programados para hoy
          </h2>
          <ul className="ops-lista">
            {programadas.map(({ visita, ref }, i) => {
              const id = idFormulario(visita.clienteId, visita.proyectoId, visita.servicioId);
              const estado = estadoDe(id);
              return (
                <li key={visita.id}>
                  <div className="ops-fila">
                    <span className="ops-fila__hora">{visita.hora}</span>
                    <span className="ops-fila__donde">
                      {ref.cliente.codigoCorto} <span>· {ref.proyecto.nombre}</span>
                    </span>
                    <span className="ops-fila__servicio">{ref.servicio.tipo}</span>
                    <span className="ops-fila__tecnico">{visita.tecnico}</span>
                    <Badge color={estado.color}>{estado.etiqueta}</Badge>
                    <Button
                      variant={formularios[id]?.estado === 'ENVIADO_A_REVISION' ? 'secondary' : 'primary'}
                      onClick={() => abrir(visita.clienteId, visita.proyectoId, visita.servicioId, visita.hora)}
                    >
                      {textoBoton(id)}
                    </Button>
                  </div>
                  {i < programadas.length - 1 && <PerforatedDivider />}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="ops-otro" aria-labelledby="ops-otro-t">
          <h2 id="ops-otro-t" className="ops-titulo">
            Atender otro proyecto activo
          </h2>
          <p className="ops-ayuda">No hace falta estar asignado: elija la sede y el servicio contratado.</p>
          <div className="ops-otro__campos">
            <label className="ops-campo">
              <span>Sede</span>
              <select
                id="ops-sede"
                value={sedeElegida}
                onChange={(e) => {
                  setSedeElegida(e.target.value);
                  setServicioElegido('');
                }}
              >
                <option value="">Seleccione cliente y sede…</option>
                {sedes.map((s) => (
                  <option key={`${s.cliente.id}::${s.proyecto.id}`} value={`${s.cliente.id}::${s.proyecto.id}`}>
                    {s.cliente.codigoCorto} · {s.proyecto.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="ops-campo">
              <span>Servicio</span>
              <select id="ops-servicio" value={servicioElegido} onChange={(e) => setServicioElegido(e.target.value)} disabled={!sede}>
                <option value="">{sede && serviciosDeSede.length === 0 ? 'Esta sede no tiene servicios' : 'Seleccione el servicio…'}</option>
                {serviciosDeSede.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.tipo} · {s.frecuencia}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="primary"
              disabled={!sede || !servicioElegido}
              onClick={() => sede && abrir(sede.cliente.id, sede.proyecto.id, servicioElegido, new Date().toTimeString().slice(0, 5))}
            >
              Abrir formulario
            </Button>
          </div>
        </section>

        {otros.length > 0 ? (
          <section aria-labelledby="ops-otros-t">
            <h2 id="ops-otros-t" className="ops-titulo">
              Otros formularios de hoy
            </h2>
            <ul className="ops-lista">
              {otros.map((f, i) => {
                const estado = ESTADO_VISUAL[f.estado];
                return (
                  <li key={f.id}>
                    <div className="ops-fila">
                      <span className="ops-fila__hora">{f.hora}</span>
                      <span className="ops-fila__donde">
                        {f.clienteCodigo} <span>· {f.proyectoNombre}</span>
                      </span>
                      <span className="ops-fila__servicio">{f.servicioEtiqueta}</span>
                      <span className="ops-fila__tecnico">{f.guardados.at(-1)?.usuario ?? '—'}</span>
                      <Badge color={estado.color}>{estado.etiqueta}</Badge>
                      <Button variant={f.estado === 'BORRADOR' ? 'primary' : 'secondary'} onClick={() => setAbierto(f)}>
                        {f.estado === 'BORRADOR' ? 'Continuar' : 'Ver formulario'}
                      </Button>
                    </div>
                    {i < otros.length - 1 && <PerforatedDivider />}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
