import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OperacionesForm } from './OperacionesForm';
import { crearBorradorVacio } from '../model/tipos';

describe('OperacionesForm (presentacional)', () => {
  it('se testea sin mockear red ni IndexedDB — solo props', () => {
    const onActualizarBloque = vi.fn();
    render(
      <OperacionesForm
        estadoRemoto="BORRADOR"
        borrador={crearBorradorVacio('servicio-1')}
        onActualizarBloque={onActualizarBloque}
        onGuardarBorrador={() => {}}
        onCerrarInspeccion={() => {}}
      />,
    );

    expect(screen.getByText('Borrador')).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText('Detalle por zona');
    fireEvent.change(textarea, { target: { value: 'Actividad en zona A' } });
    expect(onActualizarBloque).toHaveBeenCalledWith('diagnostico', {
      hallazgoCatalogo: '',
      textoLibre: 'Actividad en zona A',
    });
  });

  it('llama a onCerrarInspeccion al hacer click en el botón de cierre', () => {
    const onCerrarInspeccion = vi.fn();
    render(
      <OperacionesForm
        estadoRemoto={null}
        borrador={crearBorradorVacio('servicio-1')}
        onActualizarBloque={() => {}}
        onGuardarBorrador={() => {}}
        onCerrarInspeccion={onCerrarInspeccion}
      />,
    );

    fireEvent.click(screen.getByText('Cerrar inspección'));
    expect(onCerrarInspeccion).toHaveBeenCalledOnce();
  });

  it('deshabilita los campos cuando la inspección ya está CERRADO', () => {
    render(
      <OperacionesForm
        estadoRemoto="CERRADO"
        borrador={crearBorradorVacio('servicio-1')}
        onActualizarBloque={() => {}}
        onGuardarBorrador={() => {}}
        onCerrarInspeccion={() => {}}
      />,
    );

    expect(screen.getByPlaceholderText('Detalle por zona')).toBeDisabled();
    expect(screen.getByText('Inspección cerrada')).toBeDisabled();
  });
});
