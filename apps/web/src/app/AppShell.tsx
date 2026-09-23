import { useState } from 'react';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { NOMBRE_ROL, type Rol } from '../features/auth/model/roles';
import { DashboardPage } from '../features/estadisticas/pages/DashboardPage';
import { ClientesModule } from '../features/cliente-expediente/pages/ClientesModule';
import { BandejaAprobacionPage } from '../features/documentos/pages/BandejaAprobacionPage';
import { DocumentoDetailPage } from '../features/documentos/pages/DocumentoDetailPage';
import { DOCUMENTOS_DETALLE_MOCK, DOCUMENTOS_MOCK } from '../features/documentos/model/documentos-mock';
import { MapaMurinoPage } from '../features/mapa-murino/pages/MapaMurinoPage';
import { MantenimientoPage } from '../features/mantenimiento/pages/MantenimientoPage';
import { InventarioPage } from '../features/inventario/pages/InventarioPage';
import { OperacionesModule } from '../features/operaciones/pages/OperacionesModule';
import { useOperaciones } from '../features/operaciones/model/operaciones-context';
import './app-shell.css';

type Pantalla = 'DASHBOARD' | 'OPERACIONES' | 'CLIENTES' | 'DOCUMENTOS' | 'MAPA_MURINO' | 'MANTENIMIENTO' | 'INVENTARIO';

interface Sesion {
  rol: Rol;
  usuario: string;
}

const PANTALLAS: Array<{ id: Pantalla; etiqueta: string }> = [
  { id: 'DASHBOARD', etiqueta: 'Panel de control' },
  { id: 'OPERACIONES', etiqueta: 'Servicios de campo' },
  { id: 'CLIENTES', etiqueta: 'Clientes' },
  { id: 'DOCUMENTOS', etiqueta: 'Documentos' },
  { id: 'MAPA_MURINO', etiqueta: 'Mapa Murino' },
  { id: 'MANTENIMIENTO', etiqueta: 'Mantenimiento' },
  { id: 'INVENTARIO', etiqueta: 'Inventario' },
];

/**
 * Qué pantallas ve cada rol — spec §12 (tabla de roles): los tres registran
 * y cierran inspecciones (Servicios de campo, Mapa Murino). Administrador y
 * Supervisor comparten el backoffice (Mantenimiento se restringe adentro de
 * esa pantalla). El Técnico Operario no tiene Dashboard (§10.1), ni
 * Mantenimiento, ni bandeja de aprobación (§12, "Aprobación: No").
 */
const PANTALLAS_POR_ROL: Record<Rol, Pantalla[]> = {
  ADMINISTRADOR: ['DASHBOARD', 'OPERACIONES', 'CLIENTES', 'DOCUMENTOS', 'MAPA_MURINO', 'MANTENIMIENTO', 'INVENTARIO'],
  SUPERVISOR: ['DASHBOARD', 'OPERACIONES', 'CLIENTES', 'DOCUMENTOS', 'MAPA_MURINO', 'MANTENIMIENTO', 'INVENTARIO'],
  TECNICO_OPERARIO: ['OPERACIONES', 'MAPA_MURINO'],
};

const PANTALLA_INICIAL: Record<Rol, Pantalla> = {
  ADMINISTRADOR: 'DASHBOARD',
  SUPERVISOR: 'DASHBOARD',
  TECNICO_OPERARIO: 'OPERACIONES',
};

/**
 * Backoffice web — el rol Técnico Operario, en el producto real, trabaja
 * desde apps/mobile (nativo); acá se lo incluye como vista reducida del
 * mismo mockup para demostrar los tres roles desde un solo lugar. Login
 * cosmético: el rol elegido en LoginPage es la única fuente de permisos.
 */
export function AppShell() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [pantalla, setPantalla] = useState<Pantalla>('DASHBOARD');
  const [documentoAbierto, setDocumentoAbierto] = useState<string | null>(null);
  const { documentosCampo } = useOperaciones();

  if (!sesion) {
    return (
      <LoginPage
        onIngresar={(rol, usuario) => {
          setSesion({ rol, usuario });
          setPantalla(PANTALLA_INICIAL[rol]);
          setDocumentoAbierto(null);
        }}
      />
    );
  }

  const pantallasVisibles = PANTALLAS.filter((p) => PANTALLAS_POR_ROL[sesion.rol].includes(p.id));
  const documentos = [...documentosCampo, ...DOCUMENTOS_MOCK];
  const detalleAbierto = documentoAbierto
    ? (documentosCampo.find((d) => d.id === documentoAbierto) ?? DOCUMENTOS_DETALLE_MOCK[documentoAbierto])
    : undefined;

  function abrirDocumento(id: string) {
    setPantalla('DOCUMENTOS');
    setDocumentoAbierto(id);
  }

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
          <DashboardPage rol={sesion.rol} documentos={documentos} onAbrirDocumento={abrirDocumento} />
        ) : null}
        {pantalla === 'OPERACIONES' ? (
          <OperacionesModule usuario={sesion.usuario} onAbrirMapaMurino={() => setPantalla('MAPA_MURINO')} />
        ) : null}
        {pantalla === 'CLIENTES' ? <ClientesModule puedeDarDeAlta={sesion.rol === 'ADMINISTRADOR'} /> : null}
        {pantalla === 'DOCUMENTOS' ? (
          detalleAbierto ? (
            <DocumentoDetailPage key={detalleAbierto.id} detalle={detalleAbierto} />
          ) : (
            <BandejaAprobacionPage documentos={documentos} onAbrirDocumento={setDocumentoAbierto} />
          )
        ) : null}
        {pantalla === 'MAPA_MURINO' ? <MapaMurinoPage /> : null}
        {pantalla === 'MANTENIMIENTO' && sesion.rol !== 'TECNICO_OPERARIO' ? <MantenimientoPage rol={sesion.rol} /> : null}
        {pantalla === 'INVENTARIO' ? <InventarioPage /> : null}
      </div>
    </div>
  );
}
