import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renderiza el texto recibido con la clase del color correspondiente', () => {
    render(<Badge color="ROJO">Estación 12</Badge>);
    const badge = screen.getByText('Estación 12');
    expect(badge.className).toContain('badge--rojo');
  });

  it('cambia de clase cuando cambia el color', () => {
    render(<Badge color="VERDE">Estación 3</Badge>);
    const badge = screen.getByText('Estación 3');
    expect(badge.className).toContain('badge--verde');
    expect(badge.className).not.toContain('badge--rojo');
  });
});
