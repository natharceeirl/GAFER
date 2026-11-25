import { fechaHoyLima } from './fecha-hoy';

describe('fechaHoyLima', () => {
  it('usa la fecha de Lima (UTC-5), no la de UTC', () => {
    expect(fechaHoyLima(new Date('2026-11-25T02:30:00Z'))).toBe('2026-11-24');
    expect(fechaHoyLima(new Date('2026-11-25T05:00:00Z'))).toBe('2026-11-25');
  });

  it('devuelve AAAA-MM-DD', () => {
    expect(fechaHoyLima()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
