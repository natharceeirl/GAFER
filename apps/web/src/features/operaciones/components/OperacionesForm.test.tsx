import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OperacionesForm } from './OperacionesForm';

describe('OperacionesForm (presentacional)', () => {
  it('se testea sin mockear red ni IndexedDB — solo props', () => {
    const onCambiarObservaciones = vi.fn();
    render(
      <OperacionesForm
        estadoRemoto="BORRADOR"
        observaciones="texto inicial"
        onIniciar={() => {}}
        onCambiarObservaciones={onCambiarObservaciones}
      />,
    );

    expect(screen.getByText('BORRADOR')).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText('Observaciones técnicas');
    fireEvent.change(textarea, { target: { value: 'nueva observación' } });
    expect(onCambiarObservaciones).toHaveBeenCalledWith('nueva observación');
  });

  it('llama a onIniciar al hacer click en el botón', () => {
    const onIniciar = vi.fn();
    render(
      <OperacionesForm
        estadoRemoto={null}
        observaciones=""
        onIniciar={onIniciar}
        onCambiarObservaciones={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('Iniciar inspección'));
    expect(onIniciar).toHaveBeenCalledOnce();
  });
});
