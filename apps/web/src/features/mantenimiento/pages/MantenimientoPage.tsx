import { useState } from 'react';
import type { Equipo, Insumo, Personal } from '@gafer/contracts';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import type { Rol } from '../../auth/model/roles';
import { CatalogosTextoSeccion } from './CatalogosTextoSeccion';
import { ConfiguracionSeccion } from './ConfiguracionSeccion';
import { EquipoFormulario } from './EquipoFormulario';
import { EquiposSeccion } from './EquiposSeccion';
import { InsumoFormulario } from './InsumoFormulario';
import { InsumosSeccion } from './InsumosSeccion';
import { PersonalFormulario } from './PersonalFormulario';
import { PersonalSeccion } from './PersonalSeccion';
import './mantenimiento-page.css';

const SECCIONES = {
  insumos: 'Insumos',
  equipos: 'Equipos',
  personal: 'Personal',
  configuracion: 'Configuración',
  catalogos: 'Catálogos de texto',
} as const;

type SeccionId = keyof typeof SECCIONES;

/**
 * Administrador tiene acceso completo a Mantenimiento; Supervisor solo edita catálogos de texto
 * (observaciones, recomendaciones) y lee la configuración — spec §7 y tabla de roles §12.
 * El orden es el de la navegación: cada rol abre en su primera sección.
 */
const SECCIONES_POR_ROL: Record<Rol, SeccionId[]> = {
  ADMINISTRADOR: ['insumos', 'equipos', 'personal', 'configuracion', 'catalogos'],
  SUPERVISOR: ['catalogos', 'configuracion'],
};

interface MantenimientoPageProps {
  rol: Rol;
}

/** Formulario abierto en lugar de la pantalla: alta (sin registro) o edición (con el registro elegido). */
type Formulario = { tipo: 'insumo'; insumo?: Insumo } | { tipo: 'equipo'; equipo?: Equipo } | { tipo: 'persona'; persona?: Personal };

export function MantenimientoPage({ rol }: MantenimientoPageProps) {
  const seccionesVisibles = SECCIONES_POR_ROL[rol];
  const [seccion, setSeccion] = useState<SeccionId>(seccionesVisibles[0]);
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
  if (formulario?.tipo === 'persona') {
    return <PersonalFormulario persona={formulario.persona} onTerminar={cerrarFormulario} onCancelar={() => cerrarFormulario(null)} />;
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
          {seccionesVisibles.map((id) => (
            <button
              key={id}
              type="button"
              className={`mant-rail__item ${seccion === id ? 'mant-rail__item--activo' : ''}`}
              onClick={() => {
                setSeccion(id);
                setAviso(null);
              }}
            >
              {SECCIONES[id]}
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
          {seccion === 'personal' && <PersonalSeccion onNuevo={() => setFormulario({ tipo: 'persona' })} onEditar={(persona) => setFormulario({ tipo: 'persona', persona })} />}
          {seccion === 'configuracion' && <ConfiguracionSeccion soloLectura={rol !== 'ADMINISTRADOR'} />}
          {seccion === 'catalogos' && <CatalogosTextoSeccion />}
        </div>
      </div>
    </div>
  );
}
