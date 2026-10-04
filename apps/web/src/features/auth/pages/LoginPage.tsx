import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../../shared/ui/atoms/Button';
import { LogoGafer } from '../../../shared/ui/atoms/LogoGafer';
import { BotonTema } from '../../../shared/ui/atoms/BotonTema';
import { mensajeDeError } from '../../../shared/api/errores';
import { ingresar } from '../model/login';
import './login-page.css';

/**
 * Ingreso al backoffice con usuario y clave (§12). El rol lo define el servidor
 * y queda en la sesión; el Técnico Operador trabaja desde la app Android y no entra por aquí.
 */
export function LoginPage() {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const acceso = useMutation({ mutationFn: ({ usuario, clave }: { usuario: string; clave: string }) => ingresar(usuario, clave) });

  const puedeIngresar = usuario.trim() !== '' && clave !== '' && !acceso.isPending;

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!puedeIngresar) return;
    acceso.mutate({ usuario: usuario.trim(), clave });
  }

  return (
    <div className="login-page">
      <div className="login-page__tema">
        <BotonTema />
      </div>
      <form className="login-card" onSubmit={enviar}>
        <LogoGafer ancho={200} />
        <h1 className="login-card__titulo">Ingreso al sistema</h1>
        <p className="login-card__subtitulo">Ingrese con su usuario y clave. Su rol define las funciones que verá.</p>

        {acceso.isError ? (
          <p className="login-card__error" role="alert">
            {mensajeDeError(acceso.error)}
          </p>
        ) : null}

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
          {acceso.isPending ? 'Ingresando…' : 'Ingresar'}
        </Button>
        <p className="login-card__nota">Los técnicos operadores trabajan desde la app Android.</p>
      </form>
    </div>
  );
}
