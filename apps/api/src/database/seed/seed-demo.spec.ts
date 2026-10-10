import { formatearResumenLimpieza, formatearResumenSiembra } from './seed-demo';
import { ResultadoLimpieza, ResultadoSembrado } from './sembrar-demo';

const vacio = { creados: 0, sinCambios: 0 };

describe('Resumen que imprime db:seed:demo', () => {
  it('informa por entidad cuántas filas se crearon y cuántas ya estaban', () => {
    const resultado: ResultadoSembrado = {
      conteos: {
        personal: { creados: 5, sinCambios: 0 },
        insumos: { creados: 12, sinCambios: 0 },
        equipos: vacio,
        clientes: { creados: 0, sinCambios: 12 },
        sedes: vacio,
        servicios: vacio,
        textos: { creados: 3, sinCambios: 53 },
        configuracion: { creados: 0, sinCambios: 1 },
      },
      credenciales: [],
    };

    const texto = formatearResumenSiembra(resultado);

    expect(texto).toMatch(/personal\s+5 creados/);
    expect(texto).toMatch(/clientes\s+sin cambios \(12 ya existían\)/);
    expect(texto).toMatch(/textos de catálogo\s+3 creados, 53 ya existían/);
    expect(texto).toMatch(/configuración\s+sin cambios/);
  });

  it('cuando no cambia nada lo dice con todas las letras', () => {
    const conteos = Object.fromEntries(
      ['personal', 'insumos', 'equipos', 'clientes', 'sedes', 'servicios', 'textos', 'configuracion'].map((e) => [e, { creados: 0, sinCambios: 4 }]),
    ) as ResultadoSembrado['conteos'];

    expect(formatearResumenSiembra({ conteos, credenciales: [] })).toMatch(/sin cambios en ninguna entidad/i);
  });

  it('la limpieza lista lo eliminado y avisa lo que conservó', () => {
    const resultado: ResultadoLimpieza = {
      eliminados: { textos: 56, servicios: 10, sedes: 3, clientes: 1, equipos: 0, insumos: 0, personal: 5 },
      omitidos: ['Sede DEMOPAMPA/PLANTA_ATE: conserva servicios, se conserva.'],
    };

    const texto = formatearResumenLimpieza(resultado);

    expect(texto).toMatch(/servicios\s+10 eliminados/);
    expect(texto).toMatch(/Se conservaron 1 fila/);
    expect(texto).toContain('DEMOPAMPA/PLANTA_ATE');
  });
});
