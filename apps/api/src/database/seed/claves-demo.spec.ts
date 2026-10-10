import * as fs from 'fs';
import * as path from 'path';
import { ClaveNuevaSchema } from '@gafer/contracts';
import { verificarClave } from '../../auth/domain/clave-hash';
import { CredencialDemo, formatearCredenciales, generarClaveDemo } from './claves-demo';

describe('Claves de los usuarios de ejemplo', () => {
  it('se generan al azar, con al menos 16 caracteres y aptas para la política de claves', () => {
    const claves = Array.from({ length: 500 }, () => generarClaveDemo());

    for (const clave of claves) {
      expect(clave.length).toBeGreaterThanOrEqual(16);
      expect(ClaveNuevaSchema.safeParse(clave).success).toBe(true);
      expect(clave).toMatch(/^[A-Za-z0-9_-]+$/);
    }
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('el hash que guarda db:crear-usuario verifica la clave generada (mismo algoritmo, sin duplicarlo)', async () => {
    const { crearOActualizarUsuario } = await import('../crear-usuario');
    const clave = generarClaveDemo();
    const guardado: Array<Record<string, unknown>> = [];
    const db = {
      selectFrom: () => ({ selectAll: () => ({ where: () => ({ executeTakeFirst: async () => undefined }) }) }),
      insertInto: () => ({
        values: (valores: Record<string, unknown>) => {
          guardado.push(valores);
          return { returning: () => ({ executeTakeFirstOrThrow: async () => ({ id: 'x', usuario: 'DEMO.ADMIN', cargo: 'ADMINISTRADOR', estado: 'ACTIVO' }) }) };
        },
      }),
    };

    await crearOActualizarUsuario(db as never, {
      usuario: 'demo.admin',
      cargo: 'ADMINISTRADOR',
      dni: '99000001',
      nombres: 'Administrador',
      apellidos: 'Demo Gafer',
      telefono: '955030001',
      clave,
    });

    expect(await verificarClave(clave, guardado[0].clave_hash as string)).toBe(true);
  });

  it('la tabla impresa lista usuario, cargo y clave, y avisa que se muestra una sola vez', () => {
    const credenciales: CredencialDemo[] = [
      { usuario: 'demo.admin', cargo: 'ADMINISTRADOR', clave: 'clave-uno-generada-0001', motivo: 'creado' },
      { usuario: 'demo.supervisor', cargo: 'SUPERVISOR', clave: 'clave-dos-generada-0002', motivo: 'regenerada' },
    ];

    const tabla = formatearCredenciales(credenciales);

    expect(tabla).toContain('demo.admin');
    expect(tabla).toContain('ADMINISTRADOR');
    expect(tabla).toContain('clave-uno-generada-0001');
    expect(tabla).toContain('demo.supervisor');
    expect(tabla).toMatch(/una sola vez/i);
    expect(tabla).toMatch(/TECNICO_OPERADOR.*(móvil|mobile)|(móvil|mobile).*TECNICO_OPERADOR/is);
  });

  it('no hay ninguna clave ni contraseña escrita en los archivos del seed ni en el comando', () => {
    const carpeta = __dirname;
    const archivos = fs
      .readdirSync(carpeta)
      .filter((nombre) => nombre.endsWith('.ts') && !nombre.endsWith('.spec.ts'))
      .map((nombre) => path.join(carpeta, nombre));
    expect(archivos.length).toBeGreaterThanOrEqual(5);

    const asignacionLiteral = /\b(clave|password|passwd|contrasena|contraseña|secret|secreto|token)\w*\s*[:=]\s*['"`][^'"`]+['"`]/i;
    for (const archivo of archivos) {
      const contenido = fs.readFileSync(archivo, 'utf-8');
      expect({ archivo: path.basename(archivo), asignacion: asignacionLiteral.exec(contenido)?.[0] }).toEqual({
        archivo: path.basename(archivo),
        asignacion: undefined,
      });
      expect({ archivo: path.basename(archivo), hash: /scrypt\$\d+\$/.test(contenido) }).toEqual({
        archivo: path.basename(archivo),
        hash: false,
      });
    }
  });
});
