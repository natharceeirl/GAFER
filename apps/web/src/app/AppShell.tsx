import { useState } from 'react';
import { DashboardPage } from '../features/estadisticas/pages/DashboardPage';
import { ClientesModule } from '../features/cliente-expediente/pages/ClientesModule';
import { BandejaAprobacionPage } from '../features/documentos/pages/BandejaAprobacionPage';
import { DocumentoDetailPage } from '../features/documentos/pages/DocumentoDetailPage';
import { MapaMurinoPage } from '../features/mapa-murino/pages/MapaMurinoPage';
import { MantenimientoPage } from '../features/mantenimiento/pages/MantenimientoPage';
import { InventarioPage } from '../features/inventario/pages/InventarioPage';
import './app-shell.css';

type Pantalla = 'DASHBOARD' | 'CLIENTES' | 'DOCUMENTOS' | 'MAPA_MURINO' | 'MANTENIMIENTO' | 'INVENTARIO';

const PANTALLAS: Array<{ id: Pantalla; etiqueta: string }> = [
  { id: 'DASHBOARD', etiqueta: 'Panel de control' },
  { id: 'CLIENTES', etiqueta: 'Clientes' },
  { id: 'DOCUMENTOS', etiqueta: 'Documentos' },
  { id: 'MAPA_MURINO', etiqueta: 'Mapa Murino' },
  { id: 'MANTENIMIENTO', etiqueta: 'Mantenimiento' },
  { id: 'INVENTARIO', etiqueta: 'Inventario' },
];

/**
 * Backoffice web puro (Administrador/Supervisor) — el rol Técnico
 * vive en apps/mobile (nativo), no acá. Este riel de navegación es
 * andamiaje de revisión, no producto final (no hay login todavía).
 */
export function AppShell() {
  const [pantalla, setPantalla] = useState<Pantalla>('DASHBOARD');
  const [documentoAbierto, setDocumentoAbierto] = useState<string | null>(null);

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
      </nav>

      <div className="app-shell__stage">
        {pantalla === 'DASHBOARD' ? <DashboardPage /> : null}
        {pantalla === 'CLIENTES' ? <ClientesModule /> : null}
        {pantalla === 'DOCUMENTOS' ? (
          documentoAbierto ? (
            <DocumentoDetailPage documentoId={documentoAbierto} />
          ) : (
            <BandejaAprobacionPage onAbrirDocumento={setDocumentoAbierto} />
          )
        ) : null}
        {pantalla === 'MAPA_MURINO' ? <MapaMurinoPage /> : null}
        {pantalla === 'MANTENIMIENTO' ? <MantenimientoPage /> : null}
        {pantalla === 'INVENTARIO' ? <InventarioPage /> : null}
      </div>
    </div>
  );
}
