import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
});
