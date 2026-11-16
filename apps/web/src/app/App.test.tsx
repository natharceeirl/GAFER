import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { useSesion } from '../shared/api/sesion';

const usuario = (cargo: 'ADMINISTRADOR' | 'SUPERVISOR') => ({
  id: '3f0c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a11',
  dni: '12345678',
  nombres: 'Rosa',
  apellidos: 'Agárate',
  cargo,
  usuario: 'r.agarate',
});

describe('App: acceso según la sesión del API', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.localStorage.clear();
    useSesion.setState({ token: null, usuario: null });
  });

  it('sin sesión muestra el ingreso con usuario y clave', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Ingreso al sistema' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Rol de acceso' })).not.toBeInTheDocument();
  });

  it('con sesión toma el rol del usuario del API y permite cerrar la sesión', () => {
    useSesion.getState().iniciar('jwt', usuario('SUPERVISOR'));
    render(<App />);

    expect(screen.getByText('Supervisor')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Auditoría' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(useSesion.getState().token).toBeNull();
    expect(screen.getByRole('heading', { name: 'Ingreso al sistema' })).toBeInTheDocument();
  });

  it('el Administrador ve la bitácora de auditoría', () => {
    useSesion.getState().iniciar('jwt', usuario('ADMINISTRADOR'));
    render(<App />);

    expect(screen.getByRole('button', { name: 'Auditoría' })).toBeInTheDocument();
  });

  it('al cambiar de pantalla el contenido vuelve arriba: el contenedor con scroll se reinicia', () => {
    useSesion.getState().iniciar('jwt', usuario('ADMINISTRADOR'));
    const { container } = render(<App />);
    const contenidoAntes = container.querySelector('.app-shell__stage');

    fireEvent.click(screen.getByRole('button', { name: 'Programación' }));

    const contenidoDespues = container.querySelector('.app-shell__stage');
    expect(contenidoAntes).not.toBeNull();
    expect(contenidoDespues).not.toBe(contenidoAntes);
  });

  it('permanecer en la misma pantalla conserva el contenedor del contenido', () => {
    useSesion.getState().iniciar('jwt', usuario('ADMINISTRADOR'));
    const { container } = render(<App />);
    const contenidoAntes = container.querySelector('.app-shell__stage');

    fireEvent.click(screen.getByRole('button', { name: 'Panel de control' }));

    expect(container.querySelector('.app-shell__stage')).toBe(contenidoAntes);
  });
});

describe('App: acceso directo «Nuevo cliente» en el panel de control (GAF-99)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.localStorage.clear();
    useSesion.setState({ token: null, usuario: null });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const cuerpo = String(url).includes('/catalogos-texto') ? [] : { total: 0, limit: 100, offset: 0, items: [] };
        return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('el Administrador lo ve en el panel y lo lleva al paso 1 del alta rápida en Clientes', async () => {
    useSesion.getState().iniciar('jwt', usuario('ADMINISTRADOR'));
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo cliente' }));

    expect(await screen.findByRole('navigation', { name: 'Alta rápida de cliente' })).toHaveTextContent('Paso 1 de 3');
    expect(screen.getByRole('button', { name: 'Clientes' })).toHaveClass('app-shell__nav-btn--activo');
  });

  it('volver a Clientes desde el menú abre la cartera, no el alta', async () => {
    useSesion.getState().iniciar('jwt', usuario('ADMINISTRADOR'));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo cliente' }));
    await screen.findByRole('navigation', { name: 'Alta rápida de cliente' });

    fireEvent.click(screen.getByRole('button', { name: 'Panel de control' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clientes' }));

    expect(await screen.findByRole('heading', { name: 'Cartera de clientes' })).toBeInTheDocument();
  });

  it('el Supervisor no ve el acceso directo', () => {
    useSesion.getState().iniciar('jwt', usuario('SUPERVISOR'));
    render(<App />);

    expect(screen.queryByRole('button', { name: 'Nuevo cliente' })).not.toBeInTheDocument();
  });
});

describe('App: barra lateral plegable', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.localStorage.clear();
    useSesion.setState({ token: null, usuario: null });
  });

  it('empieza desplegada y se puede ocultar y volver a mostrar', () => {
    useSesion.getState().iniciar('jwt', usuario('ADMINISTRADOR'));
    render(<App />);

    const ocultar = screen.getByRole('button', { name: 'Ocultar menú' });
    expect(ocultar).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Programación' })).toBeInTheDocument();

    fireEvent.click(ocultar);

    expect(screen.queryByRole('button', { name: 'Programación' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
    const mostrar = screen.getByRole('button', { name: 'Mostrar menú' });
    expect(mostrar).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(mostrar);

    expect(screen.getByRole('button', { name: 'Programación' })).toBeInTheDocument();
  });

  it('con la barra oculta el contenido sigue en pantalla', () => {
    useSesion.getState().iniciar('jwt', usuario('ADMINISTRADOR'));
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar menú' }));

    expect(container.querySelector('.app-shell__stage')).not.toBeNull();
    expect(container.querySelector('.app-shell--barra-oculta')).not.toBeNull();
  });

  it('recuerda la preferencia al recargar', () => {
    useSesion.getState().iniciar('jwt', usuario('ADMINISTRADOR'));
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar menú' }));
    unmount();

    render(<App />);

    expect(screen.getByRole('button', { name: 'Mostrar menú' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Programación' })).not.toBeInTheDocument();
  });

  it('la preferencia es de cada usuario: otro usuario en el mismo navegador la ve desplegada', () => {
    useSesion.getState().iniciar('jwt', usuario('ADMINISTRADOR'));
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar menú' }));
    unmount();

    useSesion.getState().iniciar('jwt', { ...usuario('SUPERVISOR'), usuario: 'd.amamani' });
    render(<App />);

    expect(screen.getByRole('button', { name: 'Ocultar menú' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Programación' })).toBeInTheDocument();
  });

  it('al cambiar de usuario sin recargar no se hereda la preferencia del anterior', () => {
    useSesion.getState().iniciar('jwt', usuario('ADMINISTRADOR'));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar menú' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar menú' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    window.localStorage.setItem('gafer-barra-lateral:r.agarate', 'oculta');

    act(() => {
      useSesion.getState().iniciar('jwt', { ...usuario('SUPERVISOR'), usuario: 'd.amamani' });
    });

    expect(screen.getByRole('button', { name: 'Ocultar menú' })).toBeInTheDocument();

    act(() => {
      useSesion.getState().cerrar();
      useSesion.getState().iniciar('jwt', usuario('ADMINISTRADOR'));
    });

    expect(screen.getByRole('button', { name: 'Mostrar menú' })).toBeInTheDocument();
  });
});
