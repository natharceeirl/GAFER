import { useState } from 'react';
import { TecnicoHoyPage } from '../pages/TecnicoHoyPage';
import { DashboardPage } from '../features/estadisticas/pages/DashboardPage';
import { ClientesModule } from '../features/cliente-expediente/pages/ClientesModule';
import { BandejaAprobacionPage } from '../features/documentos/pages/BandejaAprobacionPage';
import { DocumentoDetailPage } from '../features/documentos/pages/DocumentoDetailPage';
import { MapaMurinoPage } from '../features/mapa-murino/pages/MapaMurinoPage';
import { MantenimientoPage } from '../features/mantenimiento/pages/MantenimientoPage';
import { InventarioPage } from '../features/inventario/pages/InventarioPage';
import './app-shell.css';

type Rol = 'TECNICO' | 'ADMIN';

type PantallaAdmin =
  | 'DASHBOARD'
  | 'CLIENTES'
  | 'DOCUMENTOS'
  | 'MAPA_MURINO'
  | 'MANTENIMIENTO'
  | 'INVENTARIO';

const PANTALLAS_ADMIN: Array<{ id: PantallaAdmin; etiqueta: string }> = [
  { id: 'DASHBOARD', etiqueta: 'Panel de control' },
  { id: 'CLIENTES', etiqueta: 'Clientes' },
  { id: 'DOCUMENTOS', etiqueta: 'Documentos' },
  { id: 'MAPA_MURINO', etiqueta: 'Mapa Murino' },
  { id: 'MANTENIMIENTO', etiqueta: 'Mantenimiento' },
  { id: 'INVENTARIO', etiqueta: 'Inventario' },
];

/**
 * Cambiador de rol/pantalla para revisar el mockup completo — no es
 * parte del producto final (no hay login todavía), es el andamiaje
 * que hace navegable esta tanda de pantallas de punta a punta.
 */
export function AppShell() {
  const [rol, setRol] = useState<Rol>('TECNICO');
  const [pantalla, setPantalla] = useState<PantallaAdmin>('DASHBOARD');
  const [documentoAbierto, setDocumentoAbierto] = useState<string | null>(null);

  return (
    <div className="app-shell">
      <nav className="app-shell__rail" aria-label="Selector de rol y pantalla (solo para revisión del mockup)">
        <div className="app-shell__rol">
          <button
            type="button"
            className={rol === 'TECNICO' ? 'app-shell__rol-btn app-shell__rol-btn--activo' : 'app-shell__rol-btn'}
            onClick={() => setRol('TECNICO')}
          >
            Técnico
          </button>
          <button
            type="button"
            className={rol === 'ADMIN' ? 'app-shell__rol-btn app-shell__rol-btn--activo' : 'app-shell__rol-btn'}
            onClick={() => setRol('ADMIN')}
          >
            Admin / Supervisor
          </button>
        </div>

        {rol === 'ADMIN' ? (
          <ul className="app-shell__nav">
            {PANTALLAS_ADMIN.map((item) => (
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
        ) : null}
      </nav>

      <div className="app-shell__stage">
        {rol === 'TECNICO' ? <TecnicoHoyPage /> : null}

        {rol === 'ADMIN' && pantalla === 'DASHBOARD' ? <DashboardPage /> : null}
        {rol === 'ADMIN' && pantalla === 'CLIENTES' ? <ClientesModule /> : null}
        {rol === 'ADMIN' && pantalla === 'DOCUMENTOS' ? (
          documentoAbierto ? (
            <DocumentoDetailPage documentoId={documentoAbierto} />
          ) : (
            <BandejaAprobacionPage onAbrirDocumento={setDocumentoAbierto} />
          )
        ) : null}
        {rol === 'ADMIN' && pantalla === 'MAPA_MURINO' ? <MapaMurinoPage /> : null}
        {rol === 'ADMIN' && pantalla === 'MANTENIMIENTO' ? <MantenimientoPage /> : null}
        {rol === 'ADMIN' && pantalla === 'INVENTARIO' ? <InventarioPage /> : null}
      </div>
    </div>
  );
}
