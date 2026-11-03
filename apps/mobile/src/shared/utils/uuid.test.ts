import { describe, it, expect } from 'vitest';
import { generarUuid } from './uuid';

describe('generarUuid', () => {
  it('genera un UUID v4 válido según regex RFC 4122', () => {
    const uuid = generarUuid();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('genera identificadores únicos en llamadas consecutivas', () => {
    const s = new Set<string>();
    for (let i = 0; i < 100; i++) {
      s.add(generarUuid());
    }
    expect(s.size).toBe(100);
  });
});
