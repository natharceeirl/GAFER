import { useState } from 'react';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { Button } from '../../../shared/ui/atoms/Button';
import type { Rol } from '../../auth/model/roles';
import { INSUMOS_MOCK, EQUIPOS_MOCK, PERSONAL_MOCK, CATALOGOS_TEXTO_MOCK } from '../model/mantenimiento-mock';
import type { CatalogoTexto, EstadoOperativo } from '../model/tipos';
import './mantenimiento-page.css';

const SECCIONES = [
  { id: 'insumos', etiqueta: 'Insumos' },
  { id: 'equipos', etiqueta: 'Equipos' },
  { id: 'personal', etiqueta: 'Personal' },
  { id: 'catalogos', etiqueta: 'Catálogos de texto' },
] as const;

type SeccionId = (typeof SECCIONES)[number]['id'];

/**
 * Administrador tiene acceso completo a Mantenimiento; Supervisor solo
 * a catálogos de texto (observaciones, recomendaciones) — spec §7 y
 * tabla de roles §12.
 */
const SECCIONES_POR_ROL: Record<Rol, SeccionId[]> = {
  ADMINISTRADOR: ['insumos', 'equipos', 'personal', 'catalogos'],
  SUPERVISOR: ['catalogos'],
};

const ETIQUETA_OPERATIVO: Record<EstadoOperativo, string> = {
  OPERATIVO: 'Operativo',
  EN_MANTENIMIENTO: 'En mantenimiento',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
};

function TablaInsumos() {
  return (
    <table className="mant-tabla tabular">
      <thead>
        <tr>
          <th>Producto</th>
          <th>Principio activo</th>
          <th>Presentación</th>
          <th>Conc.</th>
          <th>N° DIGESA</th>
          <th>Dosis referencial</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {INSUMOS_MOCK.map((i) => (
          <tr key={i.id}>
            <td>{i.nombre}</td>
            <td>{i.principioActivo}</td>
            <td>{i.presentacion}</td>
            <td>{i.concentracion}</td>
            <td className="mant-tabla__mono">{i.registroDigesa}</td>
            <td>{i.dosisReferencial}</td>
            <td>
              <span className={`mant-estado mant-estado--${i.estado === 'ACTIVO' ? 'ok' : 'off'}`}>{i.estado}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TablaEquipos() {
  return (
    <table className="mant-tabla tabular">
      <thead>
        <tr>
          <th>Equipo</th>
          <th>Código interno</th>
          <th>Tipo</th>
          <th>Estado operativo</th>
        </tr>
      </thead>
      <tbody>
        {EQUIPOS_MOCK.map((e) => (
          <tr key={e.id}>
            <td>{e.nombre}</td>
            <td className="mant-tabla__mono">{e.codigoInterno}</td>
            <td>{e.tipo}</td>
            <td>
              <span className={`mant-estado mant-estado--${e.estadoOperativo === 'OPERATIVO' ? 'ok' : e.estadoOperativo === 'EN_MANTENIMIENTO' ? 'warn' : 'off'}`}>
                {ETIQUETA_OPERATIVO[e.estadoOperativo]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TablaPersonal() {
  return (
    <table className="mant-tabla tabular">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>DNI</th>
          <th>Cargo</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {PERSONAL_MOCK.map((p) => (
          <tr key={p.id}>
            <td>{p.nombre}</td>
            <td className="mant-tabla__mono">{p.dni}</td>
            <td>{p.cargo}</td>
            <td>
              <span className={`mant-estado mant-estado--${p.estado === 'ACTIVO' ? 'ok' : 'off'}`}>{p.estado}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ListaCatalogo({ catalogo }: { catalogo: CatalogoTexto }) {
  const [items, setItems] = useState(catalogo.items);
  const [nuevo, setNuevo] = useState('');

  function agregar() {
    const valor = nuevo.trim();
    if (!valor) return;
    setItems((prev) => [...prev, valor]);
    setNuevo('');
  }

  function quitar(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="mant-catalogo">
      <h3>{catalogo.titulo}</h3>
      <ul className="mant-catalogo__lista">
        {items.map((item, i) => (
          <li key={item + i}>
            <span>{item}</span>
            <button type="button" className="mant-catalogo__quitar" onClick={() => quitar(i)} aria-label={`Quitar ${item}`}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="mant-catalogo__agregar">
        <input
          type="text"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          placeholder="Agregar texto al catálogo…"
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
        />
        <Button variant="secondary" onClick={agregar}>
          Agregar
        </Button>
      </div>
    </div>
  );
}

interface MantenimientoPageProps {
  rol: Rol;
}

export function MantenimientoPage({ rol }: MantenimientoPageProps) {
  const seccionesVisibles = SECCIONES.filter((s) => SECCIONES_POR_ROL[rol].includes(s.id));
  const [seccion, setSeccion] = useState<SeccionId>(seccionesVisibles[0].id);

  return (
    <div className="mant-page">
      <TicketHeader
        code={`${INSUMOS_MOCK.length + EQUIPOS_MOCK.length + PERSONAL_MOCK.length} registros`}
        title="Mantenimiento"
        meta={rol === 'ADMINISTRADOR' ? 'Catálogos editables — acceso completo' : 'Catálogos de texto — acceso de Supervisor'}
      />

      <div className="mant-page__body">
        <nav className="mant-rail" aria-label="Secciones de mantenimiento">
          {seccionesVisibles.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`mant-rail__item ${seccion === s.id ? 'mant-rail__item--activo' : ''}`}
              onClick={() => setSeccion(s.id)}
            >
              {s.etiqueta}
            </button>
          ))}
        </nav>

        <div className="mant-contenido">
          {seccion === 'insumos' && <TablaInsumos />}
          {seccion === 'equipos' && <TablaEquipos />}
          {seccion === 'personal' && <TablaPersonal />}
          {seccion === 'catalogos' && (
            <div className="mant-catalogos-grid">
              {CATALOGOS_TEXTO_MOCK.filter((c) => rol === 'ADMINISTRADOR' || !c.soloAdministrador).map((c) => (
                <ListaCatalogo key={c.id} catalogo={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
