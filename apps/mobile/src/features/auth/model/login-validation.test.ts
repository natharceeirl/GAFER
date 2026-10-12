import { describe, it, expect } from 'vitest';
import { validarFormularioLogin } from './login-validation';

describe('validarFormularioLogin', () => {
  it('es válido cuando se ingresan usuario y clave no vacíos', () => {
    const res = validarFormularioLogin('rgomez', 'Gafer2026!');
    expect(res.esValido).toBe(true);
    expect(res.errorUsuario).toBeNull();
    expect(res.errorClave).toBeNull();
  });

  it('falla cuando el usuario está vacío o solo contiene espacios', () => {
    const res = validarFormularioLogin('   ', 'Gafer2026!');
    expect(res.esValido).toBe(false);
    expect(res.errorUsuario).toBe('El nombre de usuario es obligatorio');
    expect(res.errorClave).toBeNull();
  });

  it('falla cuando la clave está vacía', () => {
    const res = validarFormularioLogin('rgomez', '');
    expect(res.esValido).toBe(false);
    expect(res.errorUsuario).toBeNull();
    expect(res.errorClave).toBe('La contraseña es obligatoria');
  });

  it('falla con ambos errores si ambos campos están vacíos', () => {
    const res = validarFormularioLogin('', '');
    expect(res.esValido).toBe(false);
    expect(res.errorUsuario).toBe('El nombre de usuario es obligatorio');
    expect(res.errorClave).toBe('La contraseña es obligatoria');
  });
});
