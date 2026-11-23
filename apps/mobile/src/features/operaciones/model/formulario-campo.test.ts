import { describe, it, expect } from 'vitest';
import {
  crearFormularioCampo,
  clasificarTipoServicio,
  validarCierre,
  cerrarFormulario,
  registrarGuardado,
  aCerrarInspeccionPayload,
  tipoDocumentoDe,
  type FormularioCampo,
  INSUMOS_CATALOGO_SEMILLA,
  EQUIPOS_CATALOGO_SEMILLA,
} from './formulario-campo';
import {
  decodificarBase64Utf8,
  esFirmaDataUriValida,
  generarSvgFirmaBase64,
} from './firma-svg';

const FIRMA_SVG_VALIDA = generarSvgFirmaBase64([
  [
    { x: 10, y: 20 },
    { x: 80, y: 60 },
    { x: 140, y: 30 },
  ],
]);

describe('formulario-campo (Mobile §4, §8.2, §8.3)', () => {
  const mockCliente = {
    id: 'cli-001',
    codigo: 'ALICORP',
    razonSocial: 'ALICORP S.A.A.',
  };

  const mockSede = {
    id: 'sede-001',
    nombre: 'PLANTA_CALLAO',
    direccion: 'Av. Argentina 4793',
  };

  const mockServicio = {
    id: 'srv-001',
    tipo: 'DESRATIZACION Y CONTROL MURINO',
    tipoServicio: 'DRT' as const,
    requiereCertificado: true,
    insumosAutorizados: [
      {
        insumoId: INSUMOS_CATALOGO_SEMILLA[1].id,
        nombreComercial: INSUMOS_CATALOGO_SEMILLA[1].nombreComercial,
        dosisReferencial: '1 bloque (20 g) por estación',
      },
    ],
    dosisReferencial: {
      [INSUMOS_CATALOGO_SEMILLA[1].id]: '1 bloque (20 g) por estación',
    },
    equiposAutorizados: [EQUIPOS_CATALOGO_SEMILLA[0].id],
  };

  function formularioBase(): FormularioCampo {
    return crearFormularioCampo({
      cliente: mockCliente,
      sede: mockSede,
      servicio: mockServicio,
      fecha: '2026-11-03',
      horaInicio: '08:30',
      tecnicoNombre: 'Marco Ipusari',
    });
  }

  function formularioCompleto(): FormularioCampo {
    const f = formularioBase();
    return {
      ...f,
      metodos: ['Cebado'],
      insumos: [
        {
          ...f.insumos[0],
          aplicado: true,
          lote: 'L-2026-09A',
          vencimiento: '2027-11-01',
          cantidad: '200',
          unidad: 'g',
          zonas: 'Perímetro exterior y garita 2',
        },
      ],
      temperatura: '22',
      humedad: '65',
      viento: '12',
      estadoGeneral: 'Regular',
      nivelInfestacion: 'Bajo',
      hallazgos: ['Actividad de roedores en área perimetral'],
      hallazgosDetalle: 'Se observaron huellas en zócalo exterior.',
      acciones: ['Refuerzo de cebado perimetral'],
      observaciones: ['Acceso normal a todas las zonas asignadas'],
      observacionesLibre: 'Cebaderos perimetrales inspeccionados.',
      recomendaciones: ['Mantener despejada la franja de 30 cm de los zócalos'],
      firma: FIRMA_SVG_VALIDA,
      firmanteNombre: 'Julio Valdivia',
      firmanteCargo: 'Supervisor de Planta',
      certificadoNumero: 'CERT-ALICORP-001-2026',
      certificadoEmision: '2026-11-03',
      certificadoVencimiento: '2026-12-03',
    };
  }

  describe('crearFormularioCampo (§8.2 - Precarga)', () => {
    it('precarga identificación de cliente, sede y servicio', () => {
      const f = formularioBase();
      expect(f.estado).toBe('BORRADOR');
      expect(f.clienteRazon).toBe('ALICORP S.A.A.');
      expect(f.proyectoNombre).toBe('PLANTA_CALLAO');
      expect(f.servicioId).toBe('srv-001');
      expect(f.tipoServicio).toBe('DRT');
      expect(f.requiereCertificado).toBe(true);
    });

    it('precarga insumos autorizados con su dosis referencial (§8.2)', () => {
      const f = formularioBase();
      expect(f.insumos).toHaveLength(1);
      expect(f.insumos[0].insumoId).toBe(INSUMOS_CATALOGO_SEMILLA[1].id);
      expect(f.insumos[0].dosisReferencial).toBe('1 bloque (20 g) por estación');
      expect(f.insumos[0].nombreComercial).toBe('DemoRaticida Bloque B');
      expect(f.insumos[0].aplicado).toBe(true);
    });

    it('precarga equipos autorizados asignados', () => {
      const f = formularioBase();
      expect(f.equipos).toContain(EQUIPOS_CATALOGO_SEMILLA[0].id);
    });

    it('incluye al técnico en la lista de personal participante', () => {
      const f = formularioBase();
      expect(f.personal).toContain('Marco Ipusari');
    });
  });

  describe('validarCierre (§4 - Validación por bloques)', () => {
    it('permite cerrar un formulario completo sin errores', () => {
      const errores = validarCierre(formularioCompleto());
      expect(errores).toEqual({});
    });

    it('bloquea el cierre de un formulario recién abierto e indica los bloques faltantes', () => {
      const errores = validarCierre(formularioBase());
      expect(errores.insumos).toBeDefined();
      expect(errores.condiciones).toBeDefined();
      expect(errores.diagnostico).toBeDefined();
      expect(errores.conformidad).toBeDefined();
      expect(errores.certificado).toBeDefined();
    });

    it('exige al menos un técnico y un equipo', () => {
      const f = { ...formularioCompleto(), personal: [], equipos: [] };
      const errores = validarCierre(f);
      expect(errores.personal).toBeDefined();
      expect(errores.equipos).toBeDefined();
    });

    it('exige lote, vencimiento, cantidad > 0 y zonas en los insumos aplicados', () => {
      const f = formularioCompleto();
      expect(validarCierre({ ...f, insumos: [{ ...f.insumos[0], lote: '' }] }).insumos).toBeDefined();
      expect(validarCierre({ ...f, insumos: [{ ...f.insumos[0], cantidad: '0' }] }).insumos).toBeDefined();
      expect(validarCierre({ ...f, insumos: [{ ...f.insumos[0], zonas: '' }] }).insumos).toBeDefined();
      expect(validarCierre({ ...f, insumos: [{ ...f.insumos[0], vencimiento: '' }] }).insumos).toBeDefined();
    });

    it('valida rangos estrictos de condiciones ambientales', () => {
      const f = formularioCompleto();
      expect(validarCierre({ ...f, temperatura: '85' }).condiciones).toBeDefined(); // > 60 °C
      expect(validarCierre({ ...f, humedad: '150' }).condiciones).toBeDefined(); // > 100 %
      expect(validarCierre({ ...f, viento: '-5' }).condiciones).toBeDefined(); // < 0
    });

    it('acepta que el responsable no estuvo disponible sin requerir firma', () => {
      const f: FormularioCampo = {
        ...formularioCompleto(),
        responsableNoDisponible: true,
        firma: null,
        firmanteNombre: '',
        firmanteCargo: '',
      };
      expect(validarCierre(f).conformidad).toBeUndefined();
    });

    it('valida fechas del certificado de saneamiento cuando es requerido', () => {
      const f = formularioCompleto();
      // Vencimiento anterior a emisión
      const fInvalido = {
        ...f,
        certificadoEmision: '2026-11-03',
        certificadoVencimiento: '2026-10-01',
      };
      expect(validarCierre(fInvalido).certificado).toBeDefined();
    });

    it('no exige certificado si el servicio no lo requiere', () => {
      const f = {
        ...formularioCompleto(),
        requiereCertificado: false,
        certificadoNumero: '',
        certificadoEmision: '',
        certificadoVencimiento: '',
      };
      expect(validarCierre(f).certificado).toBeUndefined();
    });
  });

  describe('guardado parcial y cierre (§8.2, §8.3)', () => {
    it('guarda parcialmente registrando usuario, fecha/hora y manteniéndose en BORRADOR', () => {
      const f = registrarGuardado(formularioBase(), 'm.ipusari', '2026-11-03 09:15');
      expect(f.estado).toBe('BORRADOR');
      expect(f.guardados).toHaveLength(1);
      expect(f.guardados[0].accion).toBe('Guardado parcial');
      expect(f.guardados[0].usuario).toBe('m.ipusari');
    });

    it('cierra el formulario y lo pasa a ENVIADO_A_REVISION', () => {
      const f = cerrarFormulario(formularioCompleto(), 'm.ipusari', '2026-11-03 10:45');
      expect(f.estado).toBe('ENVIADO_A_REVISION');
      expect(f.guardados.some((g) => g.accion === 'Cierre de inspección')).toBe(true);
      expect(f.guardados.some((g) => g.accion === 'Enviado a revisión')).toBe(true);
    });

    it('lanza error al intentar cerrar un formulario con bloques incompletos', () => {
      expect(() => cerrarFormulario(formularioBase(), 'm.ipusari', '2026-11-03 10:45')).toThrow(
        /no está completo/,
      );
    });
  });

  describe('aCerrarInspeccionPayload', () => {
    it('mapea los insumos y equipos al contrato estándar CerrarInspeccion', () => {
      const payload = aCerrarInspeccionPayload(formularioCompleto());
      expect(payload.consumos).toBeDefined();
      expect(payload.consumos?.length).toBe(1);
      expect(payload.consumos?.[0].insumoId).toBe(INSUMOS_CATALOGO_SEMILLA[1].id);
      expect(payload.consumos?.[0].lote).toBe('L-2026-09A');
      expect(payload.consumos?.[0].cantidadUtilizada).toBe(200);
      expect(payload.equiposIds).toEqual([EQUIPOS_CATALOGO_SEMILLA[0].id]);
    });
  });

  describe('tipoDocumentoDe (§2)', () => {
    it('desratización (DRT) genera REPORTE; otros servicios generan INFORME', () => {
      expect(tipoDocumentoDe('DRT')).toBe('REPORTE');
      expect(tipoDocumentoDe('DSF')).toBe('INFORME');
      expect(tipoDocumentoDe('DSS')).toBe('INFORME');
    });
  });

  describe('correcciones de revisión PR #34 (F4, F5, F7, F9)', () => {
    it('clasifica servicios combinados DRT correctamente sin confundirlos con DSS (F4)', () => {
      expect(clasificarTipoServicio('DESINSECTACION Y DESRATIZACION (DRT)')).toBe('DRT');
      expect(clasificarTipoServicio('DESINSECTACION Y DESRATIZACION')).toBe('DRT');
      expect(clasificarTipoServicio('Desinsectación y Desratización')).toBe('DRT');
      expect(clasificarTipoServicio('CONTROL DE ROEDORES (MURINO)')).toBe('DRT');
      expect(clasificarTipoServicio('DESINSECTACION')).toBe('DSS');
      expect(clasificarTipoServicio('DESINFECCION AMBIENTAL')).toBe('DSF');
      // Si se especifica tipoServicio explícito, prevalece
      expect(clasificarTipoServicio('DESINSECTACION Y DESRATIZACION', 'DSS')).toBe('DSS');

      const fCombinado = crearFormularioCampo({
        cliente: mockCliente,
        sede: mockSede,
        servicio: {
          id: 'd1111111-1111-4000-8000-000000000001',
          tipo: 'DESINSECTACION Y DESRATIZACION',
        },
        tecnicoNombre: 'Marco Ipusari',
      });
      expect(fCombinado.tipoServicio).toBe('DRT');
      expect(fCombinado.metodos).toContain('Cebado');
      expect(fCombinado.insumos[0].principioActivo).toBe('Brodifacoum');
      expect(tipoDocumentoDe(fCombinado.tipoServicio)).toBe('REPORTE');
    });

    it('conserva metadatos de equipos autorizados fuera del catálogo semilla (F5)', () => {
      const equipoCustom = {
        id: 'e9999999-9999-4000-8000-000000000088',
        codigoInterno: 'EQ-CUSTOM-88',
        nombre: 'Cámara térmica FLIR',
        tipo: 'MEDICION',
      };
      const f = crearFormularioCampo({
        cliente: mockCliente,
        sede: mockSede,
        servicio: {
          id: 'd1111111-1111-4000-8000-000000000002',
          tipo: 'DESINFECCION AMBIENTAL',
          equiposAutorizados: [equipoCustom],
        },
      });
      expect(f.equipos).toEqual([equipoCustom.id]);
      expect(f.equiposCatalogo).toEqual([equipoCustom]);
    });

    it('genera SVG Base64 real y rechaza firmas simuladas o corruptas en validarCierre (F7)', () => {
      expect(() => generarSvgFirmaBase64([])).toThrow();
      expect(() => generarSvgFirmaBase64([[{ x: 1, y: 1 }]])).toThrow();
      expect(esFirmaDataUriValida(FIRMA_SVG_VALIDA)).toBe(true);
      const svg = decodificarBase64Utf8(
        FIRMA_SVG_VALIDA.replace('data:image/svg+xml;base64,', ''),
      );
      expect(svg).toContain('<svg');
      expect(svg).toContain('<path');

      const conMock = {
        ...formularioCompleto(),
        firma: 'data:image/svg+xml;base64,mockFirmaTrace-1700000000000',
      };
      expect(validarCierre(conMock).conformidad).toBeDefined();
    });

    it('valida formato ISO calendario AAAA-MM-DD en vencimiento de insumos y fechas de certificado (F9)', () => {
      const f = formularioCompleto();

      // Vencimiento de insumo con formato inválido o fecha inexistente
      expect(
        validarCierre({ ...f, insumos: [{ ...f.insumos[0], vencimiento: 'abc' }] }).insumos,
      ).toBeDefined();
      expect(
        validarCierre({ ...f, insumos: [{ ...f.insumos[0], vencimiento: '30/06/2028' }] }).insumos,
      ).toBeDefined();
      expect(
        validarCierre({ ...f, insumos: [{ ...f.insumos[0], vencimiento: '2027-02-29' }] }).insumos,
      ).toBeDefined();

      // Certificado con texto libre que pasaría comparación lexicográfica ('xyz' > 'abc')
      expect(
        validarCierre({
          ...f,
          certificadoEmision: 'abc',
          certificadoVencimiento: 'xyz',
        }).certificado,
      ).toBeDefined();
      // Formato DD/MM/AAAA rechazado explícitamente
      expect(
        validarCierre({
          ...f,
          certificadoEmision: '03/11/2026',
          certificadoVencimiento: '01/12/2026',
        }).certificado,
      ).toBeDefined();
      // Fecha calendario inexistente (febrero 30)
      expect(
        validarCierre({
          ...f,
          certificadoEmision: '2026-02-01',
          certificadoVencimiento: '2026-02-30',
        }).certificado,
      ).toBeDefined();
      // Fecha vencimiento igual a emisión
      expect(
        validarCierre({
          ...f,
          certificadoEmision: '2026-11-03',
          certificadoVencimiento: '2026-11-03',
        }).certificado,
      ).toBeDefined();
    });
  });
});
