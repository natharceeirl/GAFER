import { useState, type FormEvent } from 'react';
import type { ColorAura } from '@gafer/contracts';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { PerforatedDivider } from '../../../shared/ui/molecules/PerforatedDivider';
import { Bloque, Campo, ariaError } from '../../../shared/ui/molecules/FormFields';
import { Badge } from '../../../shared/ui/atoms/Badge';
import { Button } from '../../../shared/ui/atoms/Button';
import { useCartera } from '../../cliente-expediente/model/cartera-context';
import { proyectosDe, sedesActivas } from '../../cliente-expediente/model/cartera';
import { PERSONAL_MOCK } from '../../mantenimiento/model/mantenimiento-mock';
import { agendaDelDia, tecnicosDisponibles, validarVisita, type DatosVisita, type EstadoCampo } from '../model/programacion';
import { useProgramacion } from '../model/programacion-context';
import { ahora, fechaLocal } from '../../../shared/lib/fecha';
import { useAuditoria } from '../../auditoria/model/auditoria-context';
import type { Rol } from '../../auth/model/roles';
import './programacion-page.css';

const ESTADO: Record<EstadoCampo, { etiqueta: string; color: ColorAura }> = {
  PENDIENTE: { etiqueta: 'Pendiente', color: 'SIN_COLOR' },
  EN_CURSO: { etiqueta: 'En curso', color: 'AMARILLO' },
  EN_REVISION: { etiqueta: 'En revisión', color: 'VERDE' },
};

const VACIO: Omit<DatosVisita, 'fecha'> = {
  clienteId: '',
  proyectoId: '',
  servicioId: '',
  hora: '',
  tecnicoTitularId: '',
  observaciones: '',
};

/**
 * Programación de visitas (§8.1), para Administrador y Supervisor. Los
 * técnicos las ven y las atienden desde la app Android (decisiones C10 y
 * C11); el titular es opcional (C12).
 */
interface ProgramacionPageProps {
  usuario: string;
  rol: Rol;
}

export function ProgramacionPage({ usuario, rol }: ProgramacionPageProps) {
  const { cartera } = useCartera();
  const { visitas, programar } = useProgramacion();
  const { registrar } = useAuditoria();
  const hoy = fechaLocal();
  const [fechaAgenda, setFechaAgenda] = useState(hoy);
  const [datos, setDatos] = useState<DatosVisita>({ ...VACIO, fecha: hoy });
  const [intentado, setIntentado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const agenda = agendaDelDia(visitas, fechaAgenda);
  const tecnicos = tecnicosDisponibles(PERSONAL_MOCK);
  const sedes = sedesActivas(cartera);
  const sede = sedes.find((s) => s.cliente.id === datos.clienteId && s.proyecto.id === datos.proyectoId);
  const errores = intentado ? validarVisita(datos, hoy) : {};

  function describir(clienteId: string, proyectoId: string, servicioId: string) {
    const cliente = cartera.clientes.find((c) => c.id === clienteId);
    const proyecto = cliente ? proyectosDe(cartera, clienteId).find((p) => p.id === proyectoId) : undefined;
    const servicio = proyecto?.servicios.find((s) => s.id === servicioId);
    return { cliente: cliente?.codigoCorto ?? '—', sede: proyecto?.nombre ?? '—', servicio: servicio?.tipo ?? '—' };
  }

  function set<K extends keyof DatosVisita>(campo: K, valor: DatosVisita[K]) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
    setAviso(null);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    setIntentado(true);
    if (Object.keys(validarVisita(datos, hoy)).length > 0) return;
    programar(datos);
    const d = describir(datos.clienteId, datos.proyectoId, datos.servicioId);
    const fechaHora = ahora();
    registrar({
      id: `${fechaHora}-visita-${datos.servicioId}-${datos.fecha}-${datos.hora}`,
      fechaHora,
      usuario,
      rol,
      accion: 'Programación de visita',
      referencia: `${d.cliente} · ${d.sede}`,
      detalle: `${d.servicio} · ${datos.fecha} ${datos.hora}`,
    });
    setAviso(`Visita programada: ${d.cliente} · ${d.sede}, ${datos.fecha} a las ${datos.hora}.`);
    setFechaAgenda(datos.fecha);
    setDatos({ ...VACIO, fecha: datos.fecha });
    setIntentado(false);
  }

  return (
    <div className="prog-page">
      <TicketHeader
        code={`${agenda.length} VISITAS · ${fechaAgenda}`}
        title="Programación de visitas"
        meta="Los técnicos ven la agenda en la app Android; cualquier técnico activo puede atender cualquier visita"
      />

      <div className="prog-page__cuerpo">
        <section aria-labelledby="prog-agenda-t">
          <div className="prog-agenda__cabecera">
            <h2 id="prog-agenda-t" className="prog-titulo">
              Agenda
            </h2>
            <label className="prog-fecha">
              <span>Fecha</span>
              <input id="prog-fecha-agenda" type="date" value={fechaAgenda} onChange={(e) => setFechaAgenda(e.target.value)} />
            </label>
          </div>
          {agenda.length === 0 ? (
            <p className="prog-vacio">No hay visitas programadas para esta fecha.</p>
          ) : (
            <ul className="prog-lista">
              {agenda.map((v, i) => {
                const d = describir(v.clienteId, v.proyectoId, v.servicioId);
                const titular = PERSONAL_MOCK.find((p) => p.id === v.tecnicoTitularId);
                return (
                  <li key={v.id}>
                    <div className="prog-fila">
                      <span className="prog-fila__hora">{v.hora}</span>
                      <span className="prog-fila__donde">
                        {d.cliente} <span>· {d.sede}</span>
                      </span>
                      <span className="prog-fila__servicio">{d.servicio}</span>
                      <span className="prog-fila__tecnico">{titular ? titular.nombre : 'Sin titular · cualquier técnico'}</span>
                      <Badge color={ESTADO[v.estadoCampo].color}>{ESTADO[v.estadoCampo].etiqueta}</Badge>
                    </div>
                    {v.observaciones ? <p className="prog-fila__obs">{v.observaciones}</p> : null}
                    {i < agenda.length - 1 && <PerforatedDivider />}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <form className="prog-form" onSubmit={enviar} noValidate>
          {aviso ? (
            <p className="prog-aviso" role="status">
              {aviso}
            </p>
          ) : null}
          <Bloque titulo="Programar visita">
            <Campo id="prog-sede" label="Cliente y sede" error={errores.proyectoId} ancho="completo">
              <select
                {...ariaError('prog-sede', errores.proyectoId)}
                value={datos.clienteId && datos.proyectoId ? `${datos.clienteId}::${datos.proyectoId}` : ''}
                onChange={(e) => {
                  const [clienteId = '', proyectoId = ''] = e.target.value.split('::');
                  setDatos((prev) => ({ ...prev, clienteId, proyectoId, servicioId: '' }));
                }}
              >
                <option value="">Seleccione cliente y sede…</option>
                {sedes.map((s) => (
                  <option key={`${s.cliente.id}::${s.proyecto.id}`} value={`${s.cliente.id}::${s.proyecto.id}`}>
                    {s.cliente.codigoCorto} · {s.proyecto.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="prog-servicio" label="Servicio" error={errores.servicioId} ancho="completo">
              <select
                {...ariaError('prog-servicio', errores.servicioId)}
                value={datos.servicioId}
                onChange={(e) => set('servicioId', e.target.value)}
                disabled={!sede}
              >
                <option value="">{sede && sede.proyecto.servicios.length === 0 ? 'Esta sede no tiene servicios' : 'Seleccione el servicio…'}</option>
                {sede?.proyecto.servicios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.tipo} · {s.frecuencia}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="prog-fecha" label="Fecha" error={errores.fecha}>
              <input {...ariaError('prog-fecha', errores.fecha)} type="date" min={hoy} value={datos.fecha} onChange={(e) => set('fecha', e.target.value)} />
            </Campo>
            <Campo id="prog-hora" label="Hora" error={errores.hora}>
              <input {...ariaError('prog-hora', errores.hora)} type="time" value={datos.hora} onChange={(e) => set('hora', e.target.value)} />
            </Campo>
            <Campo
              id="prog-tecnico"
              label="Técnico titular (opcional)"
              ayuda="Solo ordena su agenda: cualquier técnico activo puede atender la visita."
              ancho="completo"
            >
              <select id="prog-tecnico" value={datos.tecnicoTitularId} onChange={(e) => set('tecnicoTitularId', e.target.value)}>
                <option value="">Sin titular</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="prog-observaciones" label="Observaciones previas (opcional)" ancho="completo">
              <textarea
                id="prog-observaciones"
                value={datos.observaciones}
                onChange={(e) => set('observaciones', e.target.value)}
                placeholder="Coordinar ingreso con vigilancia; traer EPP para altura."
              />
            </Campo>
          </Bloque>
          <div className="prog-form__acciones">
            <Button type="submit" variant="primary">
              Programar visita
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
