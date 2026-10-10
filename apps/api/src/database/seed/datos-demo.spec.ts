/**
 * datos-demo.spec.ts
 * El conjunto de datos de ejemplo (demo H1 y QA) cumple los contratos y es claramente ficticio.
 *
 * Historial de versiones
 *   v1.0  2026-10-08  ihuayhuam  Creación del archivo (GAF-94).
 */
import { leerMigraciones } from '../migrator';
import { DATOS_DEMO, DatosDemo } from './datos-demo';
import { rucTieneDigitoVerificador, validarDatosDemo } from './validar-datos-demo';

function copia(): DatosDemo {
  return JSON.parse(JSON.stringify(DATOS_DEMO)) as DatosDemo;
}

describe('Datos de ejemplo del seed (GAF-94)', () => {
  it('cada registro pasa por los esquemas de @gafer/contracts y las referencias entre entidades existen', () => {
    expect(validarDatosDemo(DATOS_DEMO)).toEqual([]);
  });

  it('trae el volumen pedido para la demo H1', () => {
    expect(DATOS_DEMO.clientes.length).toBeGreaterThanOrEqual(12);
    expect(DATOS_DEMO.insumos.length).toBeGreaterThanOrEqual(12);
    expect(DATOS_DEMO.equipos.length).toBeGreaterThanOrEqual(10);
    const textos = Object.values(DATOS_DEMO.catalogos).reduce((total, items) => total + (items?.length ?? 0), 0);
    expect(textos).toBeGreaterThanOrEqual(50);

    for (const cliente of DATOS_DEMO.clientes) {
      const sedes = DATOS_DEMO.sedes.filter((s) => s.clienteCodigo === cliente.codigoCorto);
      expect(sedes.length).toBeGreaterThanOrEqual(1);
      expect(sedes.length).toBeLessThanOrEqual(3);
      for (const sede of sedes) {
        const servicios = DATOS_DEMO.servicios.filter((s) => s.clienteCodigo === cliente.codigoCorto && s.sede === sede.nombre);
        expect(servicios.length).toBeGreaterThanOrEqual(1);
        expect(servicios.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('cubre todos los tipos de servicio, varias frecuencias y servicios con y sin certificado', () => {
    const tipos = new Set(DATOS_DEMO.servicios.map((s) => s.tipoServicio));
    expect([...tipos].sort()).toEqual(['DRT', 'DSF', 'DSS', 'LAM', 'LRA', 'LTG', 'LTS']);
    expect(new Set(DATOS_DEMO.servicios.map((s) => s.frecuencia)).size).toBeGreaterThanOrEqual(5);
    expect(DATOS_DEMO.servicios.some((s) => s.requiereCertificado && s.vigenciaDias)).toBe(true);
    expect(DATOS_DEMO.servicios.some((s) => !s.requiereCertificado)).toBe(true);
  });

  it('incluye un Administrador, un Supervisor y al menos tres Técnicos Operadores con usuario', () => {
    const porCargo = (cargo: string) => DATOS_DEMO.personal.filter((p) => p.cargo === cargo);
    expect(porCargo('ADMINISTRADOR').length).toBeGreaterThanOrEqual(1);
    expect(porCargo('SUPERVISOR').length).toBeGreaterThanOrEqual(1);
    expect(porCargo('TECNICO_OPERADOR').length).toBeGreaterThanOrEqual(3);
    for (const persona of DATOS_DEMO.personal) {
      expect(persona.usuario).toMatch(/^demo\./);
    }
  });

  it('es claramente ficticio: RUC con dígito verificador, correos de example.com y claves con prefijo DEMO', () => {
    for (const cliente of DATOS_DEMO.clientes) {
      expect(rucTieneDigitoVerificador(cliente.ruc)).toBe(true);
      expect(cliente.contactoCorreo).toMatch(/@example\.com$/);
      expect(cliente.codigoCorto).toMatch(/^DEMO/);
    }
    for (const insumo of DATOS_DEMO.insumos) expect(insumo.registroDigesa).toMatch(/^DEMO-/);
    for (const equipo of DATOS_DEMO.equipos) expect(equipo.codigoInterno).toMatch(/^EQ-DEMO-/);
  });

  it('los textos de catálogo no repiten los que ya siembran las migraciones', async () => {
    const migraciones = (await leerMigraciones('up')).map((m) => m.sql).join('\n');
    for (const [catalogo, items] of Object.entries(DATOS_DEMO.catalogos)) {
      expect(new Set(items).size).toBe(items?.length);
      for (const item of items ?? []) {
        expect({ catalogo, item, yaSembrado: migraciones.includes(`"${item}"`) }).toEqual({ catalogo, item, yaSembrado: false });
      }
    }
  });

  describe('validarDatosDemo detecta datos que no cumplen los contratos', () => {
    it('un RUC que no tiene 11 dígitos', () => {
      const datos = copia();
      datos.clientes[0].ruc = '2099107001';
      expect(validarDatosDemo(datos).join('\n')).toMatch(/clientes\[0\].*ruc/i);
    });

    it('un servicio con certificado y sin vigencia', () => {
      const datos = copia();
      datos.servicios[0].requiereCertificado = true;
      datos.servicios[0].vigenciaDias = null;
      expect(validarDatosDemo(datos).join('\n')).toMatch(/servicios\[0\].*vigencia/i);
    });

    it('una sede que apunta a un cliente inexistente', () => {
      const datos = copia();
      datos.sedes[0].clienteCodigo = 'NOEXISTE';
      expect(validarDatosDemo(datos).join('\n')).toMatch(/sedes\[0\].*NOEXISTE/);
    });

    it('un servicio que usa un insumo o equipo fuera del conjunto', () => {
      const datos = copia();
      datos.servicios[0].insumos = ['DEMO-NO-EXISTE'];
      datos.servicios[0].equipos = ['EQ-DEMO-999'];
      const problemas = validarDatosDemo(datos).join('\n');
      expect(problemas).toMatch(/DEMO-NO-EXISTE/);
      expect(problemas).toMatch(/EQ-DEMO-999/);
    });

    it('claves naturales repetidas (RUC, código de equipo, DNI)', () => {
      const datos = copia();
      datos.clientes[1].ruc = datos.clientes[0].ruc;
      datos.equipos[1].codigoInterno = datos.equipos[0].codigoInterno;
      datos.personal[1].dni = datos.personal[0].dni;
      const problemas = validarDatosDemo(datos).join('\n');
      expect(problemas).toMatch(/RUC repetido/);
      expect(problemas).toMatch(/código de equipo repetido/i);
      expect(problemas).toMatch(/DNI repetido/);
    });

    it('un usuario que no cumple CrearUsuarioSchema', () => {
      const datos = copia();
      datos.personal[0].usuario = 'a';
      expect(validarDatosDemo(datos).join('\n')).toMatch(/personal\[0\].*usuario/i);
    });
  });
});
