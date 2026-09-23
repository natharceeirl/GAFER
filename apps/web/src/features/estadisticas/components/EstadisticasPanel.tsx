import { useMemo, useState } from 'react';
import type { TipoServicio } from '@gafer/contracts';
import { TIPOS_SERVICIO } from '../../cliente-expediente/model/catalogos-servicio';
import {
  clientesSinServicio,
  consumoMensual,
  ejecutadosVsProgramados,
  estacionesCriticas,
  mesesHasta,
  serviciosPorTecnico,
  serviciosPorTipo,
  vencimientosCertificados,
  type ServicioRegistro,
} from '../model/estadisticas';
import { TIPOS_CONTRATADOS, VENCIMIENTOS } from '../model/historial-mock';
import { estacionesRojoDe } from '../../mapa-murino/model/mapas-mock';
import { BarrasAgrupadas, BarrasApiladas, BarrasHorizontales, Filtro, Tarjeta } from './Graficos';

interface Props {
  historial: ServicioRegistro[];
  hoy: string;
  clientes: Array<{ id: string; codigoCorto: string; estado: 'ACTIVO' | 'INACTIVO' }>;
}

const TODOS = '';
const nombreTipo = (id: string) => TIPOS_SERVICIO.find((t) => t.id === id)?.nombre ?? id;
const opcionesTipo = [{ valor: TODOS, texto: 'Todos' }, ...TIPOS_CONTRATADOS.map((t) => ({ valor: t, texto: `${t} · ${nombreTipo(t)}` }))];
const PERIODOS = [
  { valor: '1', texto: 'Mes actual' },
  { valor: '3', texto: 'Últimos 3 meses' },
  { valor: '12', texto: 'Últimos 12 meses' },
];

/** Estadísticas internas del Dashboard (§10.1), cada una con los filtros que le asigna la tabla. */
export function EstadisticasPanel({ historial, hoy, clientes }: Props) {
  const tecnicos = useMemo(() => [...new Set(historial.flatMap((s) => (s.tecnico ? [s.tecnico] : [])))].sort(), [historial]);
  const productos = useMemo(() => [...new Set(historial.flatMap((s) => s.consumos.map((c) => c.producto)))].sort(), [historial]);
  const unidades = useMemo(() => new Map(historial.flatMap((s) => s.consumos.map((c) => [c.producto, c.unidad] as const))), [historial]);
  const estacionesRojo = useMemo(() => estacionesRojoDe(historial, clientes), [historial, clientes]);
  const activos = clientes.filter((c) => c.estado === 'ACTIVO');

  const [cumpl, setCumpl] = useState({ meses: '6', tecnico: TODOS, clienteId: TODOS, tipo: TODOS });
  const [periodoTipo, setPeriodoTipo] = useState('3');
  const [periodoTecnico, setPeriodoTecnico] = useState('3');
  const [tipoVenc, setTipoVenc] = useState(TODOS);
  const [consumo, setConsumo] = useState({ producto: productos[0] ?? '', tipo: TODOS });
  const [rojo, setRojo] = useState({ cliente: TODOS, proyecto: TODOS });
  const [tipoSinServicio, setTipoSinServicio] = useState(TODOS);

  const datosCumpl = ejecutadosVsProgramados(historial, mesesHasta(hoy, Number(cumpl.meses)), {
    tecnico: cumpl.tecnico || undefined,
    clienteId: cumpl.clienteId || undefined,
    tipo: (cumpl.tipo || undefined) as TipoServicio | undefined,
  });
  const totalProg = datosCumpl.reduce((s, d) => s + d.programados, 0);
  const totalEjec = datosCumpl.reduce((s, d) => s + d.ejecutados, 0);
  const venc = vencimientosCertificados(VENCIMIENTOS, hoy, (tipoVenc || null) as TipoServicio | null);
  const estaciones = estacionesCriticas(estacionesRojo, { cliente: rojo.cliente || undefined, proyecto: rojo.proyecto || undefined });
  const sinServicio = clientesSinServicio(historial, clientes, hoy, (tipoSinServicio || null) as TipoServicio | null);

  return (
    <div className="dash-graficos">
      <Tarjeta
        titulo="Servicios ejecutados vs. programados"
        ayuda={
          totalProg > 0
            ? `Cumplimiento del calendario: ${totalEjec} de ${totalProg} (${Math.round((totalEjec / totalProg) * 100)} %)`
            : 'Sin servicios programados con este filtro'
        }
        ancho="completo"
        filtros={
          <>
            <Filtro
              id="est-cumpl-periodo"
              etiqueta="Período"
              valor={cumpl.meses}
              opciones={[
                { valor: '3', texto: 'Últimos 3 meses' },
                { valor: '6', texto: 'Últimos 6 meses' },
                { valor: '12', texto: 'Últimos 12 meses' },
              ]}
              onCambiar={(v) => setCumpl((p) => ({ ...p, meses: v }))}
            />
            <Filtro
              id="est-cumpl-tecnico"
              etiqueta="Técnico"
              valor={cumpl.tecnico}
              opciones={[{ valor: TODOS, texto: 'Todos' }, ...tecnicos.map((t) => ({ valor: t, texto: t }))]}
              onCambiar={(v) => setCumpl((p) => ({ ...p, tecnico: v }))}
            />
            <Filtro
              id="est-cumpl-cliente"
              etiqueta="Cliente"
              valor={cumpl.clienteId}
              opciones={[{ valor: TODOS, texto: 'Todos' }, ...activos.map((c) => ({ valor: c.id, texto: c.codigoCorto }))]}
              onCambiar={(v) => setCumpl((p) => ({ ...p, clienteId: v }))}
            />
            <Filtro id="est-cumpl-tipo" etiqueta="Tipo" valor={cumpl.tipo} opciones={opcionesTipo} onCambiar={(v) => setCumpl((p) => ({ ...p, tipo: v }))} />
          </>
        }
      >
        <BarrasAgrupadas datos={datosCumpl} descripcion="Barras por mes: servicios programados y ejecutados" />
      </Tarjeta>

      <Tarjeta
        titulo="Servicios por tipo"
        ayuda="Distribución de los servicios ejecutados"
        filtros={<Filtro id="est-tipo-periodo" etiqueta="Período" valor={periodoTipo} opciones={PERIODOS} onCambiar={setPeriodoTipo} />}
      >
        <BarrasHorizontales
          datos={serviciosPorTipo(historial, mesesHasta(hoy, Number(periodoTipo))).map((d) => ({ ...d, detalle: nombreTipo(d.etiqueta) }))}
          vacio="Sin servicios ejecutados en el período."
        />
      </Tarjeta>

      <Tarjeta
        titulo="Servicios por técnico"
        ayuda="Productividad: servicios ejecutados por cada técnico"
        filtros={<Filtro id="est-tecnico-periodo" etiqueta="Período" valor={periodoTecnico} opciones={PERIODOS} onCambiar={setPeriodoTecnico} />}
      >
        <BarrasHorizontales datos={serviciosPorTecnico(historial, mesesHasta(hoy, Number(periodoTecnico)))} vacio="Sin servicios ejecutados en el período." />
      </Tarjeta>

      <Tarjeta
        titulo="Vencimientos de certificados"
        ayuda="Clientes con certificados que vencen en los próximos 30, 60 y 90 días"
        ancho="completo"
        filtros={<Filtro id="est-venc-tipo" etiqueta="Tipo de servicio" valor={tipoVenc} opciones={opcionesTipo} onCambiar={setTipoVenc} />}
      >
        <div className="dash-semaforo">
          {(
            [
              ['vencidos', 'Vencidos', 'rojo'],
              ['en30', 'En 30 días', 'naranja'],
              ['en60', 'En 31 a 60 días', 'amarillo'],
              ['en90', 'En 61 a 90 días', 'verde'],
            ] as const
          ).map(([clave, titulo, color]) => (
            <div key={clave} className={`dash-semaforo__columna dash-semaforo__columna--${color}`}>
              <div className="dash-semaforo__cabecera">
                <b className="tabular">{venc[clave].length}</b>
                <span>{titulo}</span>
              </div>
              <ul>
                {venc[clave].map((v) => (
                  <li key={v.cliente + v.fecha}>
                    <span>{v.cliente}</span>
                    <span className="tabular">{v.dias < 0 ? `hace ${-v.dias} d` : `${v.dias} d`}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Consumo mensual de insumos"
        ayuda="Un producto por vez, para no sumar unidades distintas"
        ancho="completo"
        filtros={
          <>
            <Filtro
              id="est-consumo-producto"
              etiqueta="Producto"
              valor={consumo.producto}
              opciones={productos.map((p) => ({ valor: p, texto: p }))}
              onCambiar={(v) => setConsumo((p) => ({ ...p, producto: v }))}
            />
            <Filtro id="est-consumo-tipo" etiqueta="Tipo de servicio" valor={consumo.tipo} opciones={opcionesTipo} onCambiar={(v) => setConsumo((p) => ({ ...p, tipo: v }))} />
          </>
        }
      >
        <BarrasApiladas
          datos={consumoMensual(historial, mesesHasta(hoy, 6), consumo.producto, (consumo.tipo || null) as TipoServicio | null)}
          unidad={unidades.get(consumo.producto) ?? ''}
          descripcion={`Consumo mensual de ${consumo.producto}, apilado por tipo de servicio`}
        />
      </Tarjeta>

      <Tarjeta
        titulo="Estaciones con aura ROJO activa"
        ayuda="Cuatro o más visitas consecutivas con consumo"
        filtros={
          <>
            <Filtro
              id="est-rojo-cliente"
              etiqueta="Cliente"
              valor={rojo.cliente}
              opciones={[{ valor: TODOS, texto: 'Todos' }, ...[...new Set(estacionesRojo.map((e) => e.cliente))].map((c) => ({ valor: c, texto: c }))]}
              onCambiar={(v) => setRojo((p) => ({ ...p, cliente: v }))}
            />
            <Filtro
              id="est-rojo-proyecto"
              etiqueta="Proyecto"
              valor={rojo.proyecto}
              opciones={[{ valor: TODOS, texto: 'Todos' }, ...[...new Set(estacionesRojo.map((e) => e.proyecto))].map((p) => ({ valor: p, texto: p }))]}
              onCambiar={(v) => setRojo((p) => ({ ...p, proyecto: v }))}
            />
          </>
        }
      >
        <div className="dash-contador">
          <b className="tabular">{estaciones.length}</b>
          <span>{estaciones.length === 1 ? 'estación crítica' : 'estaciones críticas'}</span>
        </div>
        <ul className="dash-lista">
          {estaciones.map((e) => (
            <li key={`${e.cliente}-${e.plano}-${e.estacion}`}>
              <span>
                <strong>
                  {e.cliente} · {e.proyecto}
                </strong>{' '}
                {e.plano} · estación {e.estacion}
              </span>
              <span className="dash-lista__dato tabular">{e.visitasConsecutivas} visitas</span>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta
        titulo="Clientes sin servicio en 90+ días"
        ayuda="Clientes activos en riesgo de pérdida"
        filtros={<Filtro id="est-sin-tipo" etiqueta="Tipo de servicio" valor={tipoSinServicio} opciones={opcionesTipo} onCambiar={setTipoSinServicio} />}
      >
        {sinServicio.length === 0 ? (
          <p className="graf-vacio">Ningún cliente activo supera los 90 días sin servicio.</p>
        ) : (
          <ul className="dash-lista">
            {sinServicio.map((c) => (
              <li key={c.cliente}>
                <span>
                  <strong>{c.cliente}</strong> · último servicio {c.ultimoServicio}
                </span>
                <span className="dash-lista__dato tabular">{c.dias} días</span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
