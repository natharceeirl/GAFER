import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { Equipo, Insumo } from '@gafer/contracts';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { Bloque, Campo } from '../../../shared/ui/molecules/FormFields';
import { Button } from '../../../shared/ui/atoms/Button';
import type { Rol } from '../../auth/model/roles';
import { PERSONAL_MOCK, CATALOGOS_TEXTO_MOCK } from '../model/mantenimiento-mock';
import { useConfiguracion } from '../model/configuracion-context';
import type { CatalogoTexto } from '../model/tipos';
import { EquipoFormulario } from './EquipoFormulario';
import { EquiposSeccion } from './EquiposSeccion';
import { InsumoFormulario } from './InsumoFormulario';
import { InsumosSeccion } from './InsumosSeccion';
import './mantenimiento-page.css';

const SECCIONES = [
  { id: 'insumos', etiqueta: 'Insumos' },
  { id: 'equipos', etiqueta: 'Equipos' },
  { id: 'personal', etiqueta: 'Personal' },
  { id: 'director', etiqueta: 'Director Técnico' },
  { id: 'catalogos', etiqueta: 'Catálogos de texto' },
] as const;

type SeccionId = (typeof SECCIONES)[number]['id'];

/**
 * Administrador tiene acceso completo a Mantenimiento; Supervisor solo
 * a catálogos de texto (observaciones, recomendaciones) — spec §7 y
 * tabla de roles §12.
 */
const SECCIONES_POR_ROL: Record<Rol, SeccionId[]> = {
  ADMINISTRADOR: ['insumos', 'equipos', 'personal', 'director', 'catalogos'],
  SUPERVISOR: ['catalogos'],
};

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

/**
 * Director Técnico (decisión C7): se carga una sola vez y el sistema
 * estampa su firma y CIP en cada PDF al aprobarse, sin un cuarto usuario.
 */
function DirectorTecnicoForm() {
  const { director, setDirector } = useConfiguracion();
  const [nombre, setNombre] = useState(director?.nombre ?? '');
  const [cip, setCip] = useState(director?.cip ?? '');
  const [firma, setFirma] = useState<string | null>(director?.firma ?? null);
  const [aviso, setAviso] = useState<string | null>(null);
  const incompleto = nombre.trim() === '' || !/^\d{4,7}$/.test(cip.trim());

  function cargarFirma(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => setFirma(typeof lector.result === 'string' ? lector.result : null);
    lector.readAsDataURL(archivo);
  }

  function guardar(e: FormEvent) {
    e.preventDefault();
    if (incompleto) return;
    setDirector({ nombre: nombre.trim(), cip: cip.trim(), firma });
    setAviso('Director Técnico actualizado. Se estampará en los próximos documentos que se aprueben.');
  }

  return (
    <form className="mant-director" onSubmit={guardar} noValidate>
      {aviso ? (
        <p className="mant-director__aviso" role="status">
          {aviso}
        </p>
      ) : null}
      <Bloque titulo="Firma estampada en los PDF">
        <Campo id="dir-nombre" label="Nombre completo">
          <input id="dir-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ing. Carlos Medina Ruiz" />
        </Campo>
        <Campo id="dir-cip" label="N° de CIP" ayuda="Colegio de Ingenieros del Perú, solo números.">
          <input
            id="dir-cip"
            type="text"
            inputMode="numeric"
            className="ff-campo__mono"
            value={cip}
            onChange={(e) => setCip(e.target.value.replace(/\D/g, ''))}
            placeholder="84512"
          />
        </Campo>
        <Campo id="dir-firma" label="Firma gráfica" ayuda="Imagen PNG o JPG con fondo claro." ancho="completo">
          <input id="dir-firma" type="file" accept="image/png,image/jpeg" onChange={cargarFirma} />
        </Campo>
        {firma ? <img className="mant-director__firma ff-campo--completo" src={firma} alt="Firma cargada del Director Técnico" /> : null}
      </Bloque>
      <p className="mant-director__nota">
        Anexos del PDF: la ficha técnica y la MSDS de cada insumo se adjuntan solas cuando el insumo se consume, junto con la
        Resolución de licencia sanitaria de GAFER.
      </p>
      <div className="mant-director__acciones">
        <Button type="submit" variant="primary" disabled={incompleto}>
          Guardar Director Técnico
        </Button>
      </div>
    </form>
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

/** Formulario abierto en lugar de la pantalla: alta (sin registro) o edición (con el registro elegido). */
type Formulario = { tipo: 'insumo'; insumo?: Insumo } | { tipo: 'equipo'; equipo?: Equipo };

export function MantenimientoPage({ rol }: MantenimientoPageProps) {
  const seccionesVisibles = SECCIONES.filter((s) => SECCIONES_POR_ROL[rol].includes(s.id));
  const [seccion, setSeccion] = useState<SeccionId>(seccionesVisibles[0].id);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function cerrarFormulario(mensaje: string | null) {
    setFormulario(null);
    setAviso(mensaje);
  }

  if (formulario?.tipo === 'insumo') {
    return <InsumoFormulario insumo={formulario.insumo} onTerminar={cerrarFormulario} onCancelar={() => cerrarFormulario(null)} />;
  }
  if (formulario?.tipo === 'equipo') {
    return <EquipoFormulario equipo={formulario.equipo} onTerminar={cerrarFormulario} onCancelar={() => cerrarFormulario(null)} />;
  }

  return (
    <div className="mant-page">
      <TicketHeader
        code="CATÁLOGOS · §7"
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
              onClick={() => {
                setSeccion(s.id);
                setAviso(null);
              }}
            >
              {s.etiqueta}
            </button>
          ))}
        </nav>

        <div className="mant-contenido">
          {aviso ? (
            <p className="mant-aviso mant-aviso--ok" role="status">
              {aviso}
            </p>
          ) : null}
          {seccion === 'insumos' && <InsumosSeccion onNuevo={() => setFormulario({ tipo: 'insumo' })} onEditar={(insumo) => setFormulario({ tipo: 'insumo', insumo })} />}
          {seccion === 'equipos' && <EquiposSeccion onNuevo={() => setFormulario({ tipo: 'equipo' })} onEditar={(equipo) => setFormulario({ tipo: 'equipo', equipo })} />}
          {seccion === 'personal' && <TablaPersonal />}
          {seccion === 'director' && <DirectorTecnicoForm />}
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
