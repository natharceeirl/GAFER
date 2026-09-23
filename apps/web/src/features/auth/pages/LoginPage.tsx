import { useState, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/atoms/Button';
import { ROLES_MOCK, type Rol, type RolInfo } from '../model/roles';
import './login-page.css';

interface LoginPageProps {
  onIngresar: (rol: Rol, usuario: string) => void;
}

/**
 * El "gate pass" de entrada al sistema — elegís el rol como quien
 * presenta su credencial en la garita, y eso determina qué funciones
 * ves después (spec §12, tabla de roles). Sigue siendo mockup: no hay
 * backend de autenticación, cualquier clave no vacía es válida.
 */
export function LoginPage({ onIngresar }: LoginPageProps) {
  const [rolId, setRolId] = useState<Rol | null>(null);
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');

  const puedeIngresar = rolId !== null && usuario.trim() !== '' && clave.trim() !== '';

  function elegirRol(rol: RolInfo) {
    setRolId(rol.id);
    setUsuario(rol.usuarioSugerido);
  }

  function ingresar(e: FormEvent) {
    e.preventDefault();
    if (!rolId || !puedeIngresar) return;
    onIngresar(rolId, usuario.trim());
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={ingresar}>
        <span className="login-card__sello" aria-hidden="true">
          GAFER
        </span>
        <h1 className="login-card__titulo">Saneamiento Ambiental</h1>
        <p className="login-card__subtitulo">Elija su rol para ingresar: cada uno ve solo las funciones que le corresponden.</p>

        <div className="login-roles" role="radiogroup" aria-label="Rol de acceso">
          {ROLES_MOCK.map((rol) => (
            <button
              type="button"
              key={rol.id}
              role="radio"
              aria-checked={rolId === rol.id}
              className={rolId === rol.id ? 'login-rol login-rol--activo' : 'login-rol'}
              onClick={() => elegirRol(rol)}
            >
              <span className="login-rol__nombre">{rol.nombre}</span>
              <span className="login-rol__resumen">{rol.resumen}</span>
              <ul className="login-rol__funciones">
                {rol.funciones.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <div className="login-campos">
          <label className="login-campo">
            <span>Usuario</span>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="usuario.gafer"
              autoComplete="username"
            />
          </label>
          <label className="login-campo">
            <span>Clave</span>
            <input
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>
        </div>

        <Button type="submit" variant="primary" disabled={!puedeIngresar}>
          Ingresar
        </Button>
        <p className="login-card__nota">
          Los técnicos operadores trabajan desde la app Android. Mockup: cualquier clave no vacía es válida y el rol elegido define la
          vista.
        </p>
      </form>
    </div>
  );
}
