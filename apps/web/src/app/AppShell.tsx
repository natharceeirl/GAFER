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
import { ProgramacionPage } from '../features/programacion/pages/ProgramacionPage';
import './app-shell.css';

type Pantalla = 'DASHBOARD' | 'PROGRAMACION' | 'CLIENTES' | 'DOCUMENTOS' | 'MAPA_MURINO' | 'MANTENIMIENTO' | 'INVENTARIO';

interface Sesion {
  rol: Rol;
  usuario: string;
}

/**
 * Backoffice web para Administrador y Supervisor (§16). El técnico y el
 * formulario de campo viven solo en la app Android (decisiones C10 y C11);
 * Mantenimiento e Inventario se restringen por rol dentro de cada pantalla.
 */
const PANTALLAS: Array<{ id: Pantalla; etiqueta: string }> = [
  { id: 'DASHBOARD', etiqueta: 'Panel de control' },
  { id: 'PROGRAMACION', etiqueta: 'Programación' },
  { id: 'CLIENTES', etiqueta: 'Clientes' },
  { id: 'DOCUMENTOS', etiqueta: 'Documentos' },
  { id: 'MAPA_MURINO', etiqueta: 'Mapa Murino' },
  { id: 'MANTENIMIENTO', etiqueta: 'Mantenimiento' },
  { id: 'INVENTARIO', etiqueta: 'Inventario' },
];

export function AppShell() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [pantalla, setPantalla] = useState<Pantalla>('DASHBOARD');
  const [documentoAbierto, setDocumentoAbierto] = useState<string | null>(null);

  if (!sesion) {
    return (
      <LoginPage
        onIngresar={(rol, usuario) => {
          setSesion({ rol, usuario });
          setPantalla('DASHBOARD');
          setDocumentoAbierto(null);
        }}
      />
    );
  }

  const detalleAbierto = documentoAbierto ? DOCUMENTOS_DETALLE_MOCK[documentoAbierto] : undefined;

  function abrirDocumento(id: string) {
    setPantalla('DOCUMENTOS');
    setDocumentoAbierto(id);
  }

  return (
    <div className="app-shell">
      <nav className="app-shell__rail" aria-label="Selector de pantalla (solo para revisión del mockup)">
        <ul className="app-shell__nav">
          {PANTALLAS.map((item) => (
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
        {pantalla === 'DASHBOARD' ? <DashboardPage rol={sesion.rol} documentos={DOCUMENTOS_MOCK} onAbrirDocumento={abrirDocumento} /> : null}
        {pantalla === 'PROGRAMACION' ? <ProgramacionPage /> : null}
        {pantalla === 'CLIENTES' ? <ClientesModule puedeDarDeAlta={sesion.rol === 'ADMINISTRADOR'} /> : null}
        {pantalla === 'DOCUMENTOS' ? (
          detalleAbierto ? (
            <DocumentoDetailPage key={detalleAbierto.id} detalle={detalleAbierto} />
          ) : (
            <BandejaAprobacionPage documentos={DOCUMENTOS_MOCK} onAbrirDocumento={setDocumentoAbierto} />
          )
        ) : null}
        {pantalla === 'MAPA_MURINO' ? <MapaMurinoPage /> : null}
        {pantalla === 'MANTENIMIENTO' ? <MantenimientoPage rol={sesion.rol} /> : null}
        {pantalla === 'INVENTARIO' ? <InventarioPage /> : null}
      </div>
    </div>
  );
}
