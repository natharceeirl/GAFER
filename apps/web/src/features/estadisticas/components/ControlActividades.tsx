import { useMemo, useState } from 'react';
import type { TipoServicio } from '@gafer/contracts';
import { TIPOS_SERVICIO } from '../../cliente-expediente/model/catalogos-servicio';
import { filtrarActividades, type FiltroActividades, type ServicioRegistro } from '../model/estadisticas';
import { Filtro } from './Graficos';

interface Props {
  historial: ServicioRegistro[];
}

const TODOS = '';
const LIMITE = 40;
const VACIO = { tecnico: TODOS, clienteId: TODOS, proyecto: TODOS, tipo: TODOS, desde: '', hasta: '' };

/** Control de actividades (§11): servicios realizados, filtrables por técnico, cliente, proyecto, tipo de servicio y fecha. */
export function ControlActividades({ historial }: Props) {
  const [f, setF] = useState(VACIO);
  const opciones = useMemo(() => {
    const unicos = (valores: string[]) => [...new Set(valores)].sort();
    return {
      tecnicos: unicos(historial.flatMap((s) => (s.tecnico ? [s.tecnico] : []))),
      clientes: [...new Map(historial.map((s) => [s.clienteId, s.cliente])).entries()].sort((a, b) => a[1].localeCompare(b[1])),
      proyectos: unicos(historial.map((s) => s.proyecto)),
      tipos: unicos(historial.map((s) => s.tipo)),
    };
  }, [historial]);

  const filtro: FiltroActividades = {
    tecnico: f.tecnico || undefined,
    clienteId: f.clienteId || undefined,
    proyecto: f.proyecto || undefined,
    tipo: (f.tipo || undefined) as TipoServicio | undefined,
    desde: f.desde || undefined,
    hasta: f.hasta || undefined,
  };
  const filas = filtrarActividades(historial, filtro);
  const set = (campo: keyof typeof VACIO) => (valor: string) => setF((p) => ({ ...p, [campo]: valor }));
  const todos = (lista: Array<{ valor: string; texto: string }>) => [{ valor: TODOS, texto: 'Todos' }, ...lista];

  return (
    <div className="dash-actividades">
      <div className="graf-filtros dash-actividades__filtros">
        <Filtro id="act-tecnico" etiqueta="Técnico" valor={f.tecnico} opciones={todos(opciones.tecnicos.map((t) => ({ valor: t, texto: t })))} onCambiar={set('tecnico')} />
        <Filtro id="act-cliente" etiqueta="Cliente" valor={f.clienteId} opciones={todos(opciones.clientes.map(([id, c]) => ({ valor: id, texto: c })))} onCambiar={set('clienteId')} />
        <Filtro id="act-proyecto" etiqueta="Proyecto" valor={f.proyecto} opciones={todos(opciones.proyectos.map((p) => ({ valor: p, texto: p })))} onCambiar={set('proyecto')} />
        <Filtro
          id="act-tipo"
          etiqueta="Tipo"
          valor={f.tipo}
          opciones={todos(opciones.tipos.map((t) => ({ valor: t, texto: `${t} · ${TIPOS_SERVICIO.find((x) => x.id === t)?.nombre ?? ''}` })))}
          onCambiar={set('tipo')}
        />
        <label className="graf-filtro" htmlFor="act-desde">
          <span>Desde</span>
          <input id="act-desde" type="date" value={f.desde} onChange={(e) => set('desde')(e.target.value)} />
        </label>
        <label className="graf-filtro" htmlFor="act-hasta">
          <span>Hasta</span>
          <input id="act-hasta" type="date" value={f.hasta} onChange={(e) => set('hasta')(e.target.value)} />
        </label>
        <button type="button" className="dash-limpiar" onClick={() => setF(VACIO)}>
          Limpiar filtros
        </button>
      </div>

      <p className="dash-actividades__conteo" role="status">
        {filas.length === 0
          ? 'Ningún servicio realizado coincide con los filtros.'
          : filas.length > LIMITE
            ? `Mostrando los ${LIMITE} más recientes de ${filas.length} servicios realizados.`
            : `${filas.length} ${filas.length === 1 ? 'servicio realizado' : 'servicios realizados'}.`}
      </p>

      {filas.length > 0 ? (
        <div className="dash-tabla-marco">
          <table className="dash-tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente · proyecto</th>
                <th>Tipo</th>
                <th>Técnico</th>
                <th>Insumos</th>
              </tr>
            </thead>
            <tbody>
              {filas.slice(0, LIMITE).map((s) => (
                <tr key={s.id}>
                  <td className="tabular dash-tabla__mono">{s.fecha}</td>
                  <td>
                    <strong>{s.cliente}</strong> · {s.proyecto}
                  </td>
                  <td className="dash-tabla__mono">{s.tipo}</td>
                  <td>{s.tecnico ?? '—'}</td>
                  <td>{s.consumos.length === 0 ? '—' : s.consumos.map((c) => `${c.producto}: ${c.cantidad} ${c.unidad}`).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
