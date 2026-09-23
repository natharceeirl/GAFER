import { useState } from 'react';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { NOMBRE_ROL, type Rol } from '../features/auth/model/roles';
import { DashboardPage } from '../features/estadisticas/pages/DashboardPage';
import { ClientesModule } from '../features/cliente-expediente/pages/ClientesModule';
import { BandejaAprobacionPage } from '../features/documentos/pages/BandejaAprobacionPage';
import { DocumentoDetailPage } from '../features/documentos/pages/DocumentoDetailPage';
import { MapaMurinoPage } from '../features/mapa-murino/pages/MapaMurinoPage';
import { MantenimientoPage } from '../features/mantenimiento/pages/MantenimientoPage';
import { InventarioPage } from '../features/inventario/pages/InventarioPage';
import './app-shell.css';

type Pantalla = 'DASHBOARD' | 'CLIENTES' | 'DOCUMENTOS' | 'MAPA_MURINO' | 'MANTENIMIENTO' | 'INVENTARIO';

interface Sesion {
  rol: Rol;
  usuario: string;
}

const PANTALLAS: Array<{ id: Pantalla; etiqueta: string }> = [
  { id: 'DASHBOARD', etiqueta: 'Panel de control' },
  { id: 'CLIENTES', etiqueta: 'Clientes' },
  { id: 'DOCUMENTOS', etiqueta: 'Documentos' },
  { id: 'MAPA_MURINO', etiqueta: 'Mapa Murino' },
  { id: 'MANTENIMIENTO', etiqueta: 'Mantenimiento' },
  { id: 'INVENTARIO', etiqueta: 'Inventario' },
];

/**
 * Qué pantallas ve cada rol — spec §12 (tabla de roles): Administrador
 * y Supervisor comparten el backoffice completo (Mantenimiento se
 * restringe puertas adentro de esa pantalla, no acá). El Técnico
 * Operario solo opera Mapa Murino: sin Dashboard (§10.1, exclusivo de
 * Administrador/Supervisor), sin Mantenimiento, sin bandeja de
 * aprobación (§12, "Aprobación: No").
 */
const PANTALLAS_POR_ROL: Record<Rol, Pantalla[]> = {
  ADMINISTRADOR: ['DASHBOARD', 'CLIENTES', 'DOCUMENTOS', 'MAPA_MURINO', 'MANTENIMIENTO', 'INVENTARIO'],
  SUPERVISOR: ['DASHBOARD', 'CLIENTES', 'DOCUMENTOS', 'MAPA_MURINO', 'MANTENIMIENTO', 'INVENTARIO'],
  TECNICO_OPERARIO: ['MAPA_MURINO'],
};

const PANTALLA_INICIAL: Record<Rol, Pantalla> = {
  ADMINISTRADOR: 'DASHBOARD',
  SUPERVISOR: 'DASHBOARD',
  TECNICO_OPERARIO: 'MAPA_MURINO',
};

/**
 * Backoffice web puro — el rol Técnico Operario, en el producto real,
 * trabaja desde apps/mobile (nativo); acá se lo incluye como vista
 * reducida del mismo mockup para poder demostrar los tres roles desde
 * un solo lugar. Login cosmético: no hay backend de autenticación,
 * el rol elegido en LoginPage es la única fuente de permisos.
 */
export function AppShell() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [pantalla, setPantalla] = useState<Pantalla>('DASHBOARD');
  const [documentoAbierto, setDocumentoAbierto] = useState<string | null>(null);

  if (!sesion) {
    return (
      <LoginPage
        onIngresar={(rol, usuario) => {
          setSesion({ rol, usuario });
          setPantalla(PANTALLA_INICIAL[rol]);
        }}
      />
    );
  }

  const pantallasVisibles = PANTALLAS.filter((p) => PANTALLAS_POR_ROL[sesion.rol].includes(p.id));

  return (
    <div className="app-shell">
      <nav className="app-shell__rail" aria-label="Selector de pantalla (solo para revisión del mockup)">
        <ul className="app-shell__nav">
          {pantallasVisibles.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={
                  pantalla === item.id ? 'app-shell__nav-btn app-shell__nav-btn--activo' : 'app-shell__nav-btn'
                }
                onClick={() => {
                  setPantalla(item.id);
                  setDocumentoAbierto(null);
                }}
              >
                {item.etiqueta}
              </button>
            </li>
          ))}
        </ul>

        <div className="app-shell__sesion">
          <div className="app-shell__sesion-usuario">
            <span className="app-shell__sesion-nombre">{sesion.usuario}</span>
            <span className="app-shell__sesion-rol">{NOMBRE_ROL[sesion.rol]}</span>
          </div>
          <button type="button" className="app-shell__salir" onClick={() => setSesion(null)}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      <div className="app-shell__stage">
        {pantalla === 'DASHBOARD' && sesion.rol !== 'TECNICO_OPERARIO' ? (
          <DashboardPage
            rol={sesion.rol}
            onAbrirDocumento={(id) => {
              setPantalla('DOCUMENTOS');
              setDocumentoAbierto(id);
            }}
          />
        ) : null}
        {pantalla === 'CLIENTES' ? <ClientesModule puedeDarDeAlta={sesion.rol === 'ADMINISTRADOR'} /> : null}
        {pantalla === 'DOCUMENTOS' ? (
          documentoAbierto ? (
            <DocumentoDetailPage documentoId={documentoAbierto} />
          ) : (
            <BandejaAprobacionPage onAbrirDocumento={setDocumentoAbierto} />
          )
        ) : null}
        {pantalla === 'MAPA_MURINO' ? <MapaMurinoPage /> : null}
        {pantalla === 'MANTENIMIENTO' && sesion.rol !== 'TECNICO_OPERARIO' ? <MantenimientoPage rol={sesion.rol} /> : null}
        {pantalla === 'INVENTARIO' ? <InventarioPage /> : null}
      </div>
    </div>
  );
}
