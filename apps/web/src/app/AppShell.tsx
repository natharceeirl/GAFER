import { useState } from 'react';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { LogoGafer } from '../shared/ui/atoms/LogoGafer';
import { BotonTema } from '../shared/ui/atoms/BotonTema';
import { NOMBRE_ROL, type Rol } from '../features/auth/model/roles';
import { DashboardPage } from '../features/estadisticas/pages/DashboardPage';
import { ClientesModule } from '../features/cliente-expediente/pages/ClientesModule';
import { BandejaAprobacionPage } from '../features/documentos/pages/BandejaAprobacionPage';
import { DocumentoDetailPage } from '../features/documentos/pages/DocumentoDetailPage';
import { useDocumentos } from '../features/documentos/model/documentos-context';
import { MapaMurinoPage, type SeleccionMapa } from '../features/mapa-murino/pages/MapaMurinoPage';
import { MantenimientoPage } from '../features/mantenimiento/pages/MantenimientoPage';
import { InventarioPage } from '../features/inventario/pages/InventarioPage';
import { ProgramacionPage } from '../features/programacion/pages/ProgramacionPage';
import { AuditoriaPage } from '../features/auditoria/pages/AuditoriaPage';
import './app-shell.css';

type Pantalla =
  | 'DASHBOARD'
  | 'PROGRAMACION'
  | 'CLIENTES'
  | 'DOCUMENTOS'
  | 'MAPA_MURINO'
  | 'MANTENIMIENTO'
  | 'INVENTARIO'
  | 'AUDITORIA';

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
  { id: 'AUDITORIA', etiqueta: 'Auditoría' },
];

/** La bitácora de auditoría es exclusiva del Administrador (decisión C6). */
const SOLO_ADMINISTRADOR: Pantalla[] = ['AUDITORIA'];

export function AppShell() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [pantalla, setPantalla] = useState<Pantalla>('DASHBOARD');
  const [documentoAbierto, setDocumentoAbierto] = useState<string | null>(null);
  const [mapaSeleccion, setMapaSeleccion] = useState<SeleccionMapa | null>(null);
  const { documentos } = useDocumentos();

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

  const pantallasVisibles = PANTALLAS.filter((p) => sesion.rol === 'ADMINISTRADOR' || !SOLO_ADMINISTRADOR.includes(p.id));
  const detalleAbierto = documentoAbierto ? documentos.find((d) => d.id === documentoAbierto) : undefined;

  function abrirDocumento(id: string) {
    setPantalla('DOCUMENTOS');
    setDocumentoAbierto(id);
  }

  return (
    <div className="app-shell">
      <nav className="app-shell__rail" aria-label="Selector de pantalla (solo para revisión del mockup)">
        <LogoGafer ancho={148} />
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
          <BotonTema />
          <button type="button" className="app-shell__salir" onClick={() => setSesion(null)}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      <div className="app-shell__stage">
        {pantalla === 'DASHBOARD' ? <DashboardPage rol={sesion.rol} documentos={documentos} onAbrirDocumento={abrirDocumento} /> : null}
        {pantalla === 'PROGRAMACION' ? <ProgramacionPage usuario={sesion.usuario} rol={sesion.rol} /> : null}
        {pantalla === 'CLIENTES' ? (
          <ClientesModule
            usuario={sesion.usuario}
            rol={sesion.rol}
            onAbrirMapaMurino={(clienteId) => {
              setMapaSeleccion({ clienteId });
              setPantalla('MAPA_MURINO');
            }}
          />
        ) : null}
        {pantalla === 'DOCUMENTOS' ? (
          detalleAbierto ? (
            <DocumentoDetailPage
              key={detalleAbierto.id}
              detalle={detalleAbierto}
              rol={sesion.rol}
              usuario={sesion.usuario}
              onVolver={() => setDocumentoAbierto(null)}
            />
          ) : (
            <BandejaAprobacionPage documentos={documentos} onAbrirDocumento={setDocumentoAbierto} />
          )
        ) : null}
        {pantalla === 'MAPA_MURINO' ? <MapaMurinoPage seleccion={mapaSeleccion} onSeleccionar={setMapaSeleccion} /> : null}
        {pantalla === 'MANTENIMIENTO' ? <MantenimientoPage rol={sesion.rol} /> : null}
        {pantalla === 'INVENTARIO' ? <InventarioPage rol={sesion.rol} /> : null}
        {pantalla === 'AUDITORIA' && sesion.rol === 'ADMINISTRADOR' ? <AuditoriaPage /> : null}
      </div>
    </div>
  );
}
