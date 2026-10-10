import { describe, expect, it } from 'vitest';
import {
  ServicioContratadoActualizacionSchema,
  ServicioContratadoRegistroSchema,
  type ServicioContratadoDetalle,
} from '@gafer/contracts';
import { ErrorApi } from '../../../shared/api/errores';
import {
  actualizacionDeServicio,
  camposDeErrorServicio,
  datosDeServicio,
  registroDeServicio,
  servicioDeApi,
} from './servicio-mapper';
import type { DatosServicio } from './validaciones';

const PROYECTO = '7b1c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a33';
const INSUMO = '11111111-1111-4111-8111-111111111111';
const EQUIPO = '22222222-2222-4222-8222-222222222222';

const detalle: ServicioContratadoDetalle = {
  id: '9d1c6d5e-0d1a-4f43-9d0e-2f3a8f6f9a44',
  proyectoId: PROYECTO,
  tipoServicio: 'DRT',
  frecuencia: 'QUINCENAL',
  areaTotalM2: 1200,
  areaTratarM2: 800,
  insumosAutorizados: [INSUMO],
  equiposAutorizados: [EQUIPO],
  dosisReferencial: { [INSUMO]: '1 bloque por estación' },
  requiereCertificado: true,
  vigenciaDias: 180,
  estado: 'ACTIVO',
};

const datos: DatosServicio = {
  tipo: 'DRT',
  frecuencia: 'QUINCENAL',
  areaTotal: '1200',
  areaTratar: '800.5',
  insumos: [INSUMO],
  dosis: { [INSUMO]: ' 1 bloque por estación ', otro: 'sobrante de un insumo desmarcado' },
  equipos: [EQUIPO],
  requiereCertificado: true,
  vigenciaDias: '180',
};

describe('servicio-mapper', () => {
  it('servicioDeApi conserva los códigos del contrato y completa lo que falte', () => {
    expect(servicioDeApi(detalle)).toEqual(detalle);
    const parcial = { ...detalle, insumosAutorizados: undefined, equiposAutorizados: undefined, dosisReferencial: undefined, requiereCertificado: undefined, vigenciaDias: undefined };
    expect(servicioDeApi(parcial)).toMatchObject({
      insumosAutorizados: [],
      equiposAutorizados: [],
      dosisReferencial: {},
      requiereCertificado: false,
      vigenciaDias: null,
    });
  });

  it('datosDeServicio pasa los números a texto para el formulario', () => {
    expect(datosDeServicio(servicioDeApi(detalle))).toEqual({
      tipo: 'DRT',
      frecuencia: 'QUINCENAL',
      areaTotal: '1200',
      areaTratar: '800',
      insumos: [INSUMO],
      dosis: { [INSUMO]: '1 bloque por estación' },
      equipos: [EQUIPO],
      requiereCertificado: true,
      vigenciaDias: '180',
    });
    expect(datosDeServicio(servicioDeApi({ ...detalle, requiereCertificado: false, vigenciaDias: null })).vigenciaDias).toBe('');
  });

  it('registroDeServicio arma el cuerpo del alta con números, solo la dosis de los insumos elegidos, y cumple el esquema', () => {
    const cuerpo = registroDeServicio(PROYECTO, datos);
    expect(cuerpo).toEqual({
      proyectoId: PROYECTO,
      tipoServicio: 'DRT',
      frecuencia: 'QUINCENAL',
      areaTotalM2: 1200,
      areaTratarM2: 800.5,
      insumosAutorizados: [INSUMO],
      equiposAutorizados: [EQUIPO],
      dosisReferencial: { [INSUMO]: '1 bloque por estación' },
      requiereCertificado: true,
      vigenciaDias: 180,
    });
    expect(ServicioContratadoRegistroSchema.safeParse(cuerpo).success).toBe(true);
  });

  it('sin certificado la vigencia viaja como null aunque el campo tenga texto', () => {
    expect(registroDeServicio(PROYECTO, { ...datos, requiereCertificado: false }).vigenciaDias).toBeNull();
    expect(actualizacionDeServicio({ ...datos, requiereCertificado: false }).vigenciaDias).toBeNull();
  });

  it('actualizacionDeServicio no envía el tipo, la sede ni el estado y cumple el esquema', () => {
    const cuerpo = actualizacionDeServicio(datos);
    expect(cuerpo).not.toHaveProperty('tipoServicio');
    expect(cuerpo).not.toHaveProperty('proyectoId');
    expect(cuerpo).not.toHaveProperty('estado');
    expect(cuerpo).toMatchObject({ frecuencia: 'QUINCENAL', areaTotalM2: 1200, vigenciaDias: 180 });
    expect(ServicioContratadoActualizacionSchema.safeParse(cuerpo).success).toBe(true);
  });

  describe('camposDeErrorServicio', () => {
    it('traduce las rutas del API a los campos del formulario (areaTratarM2 → areaTratar, vigenciaDias)', () => {
      const error = new ErrorApi({
        tipo: 'validacion',
        mensaje: 'Los datos enviados no son válidos.',
        status: 400,
        campos: {
          areaTratarM2: 'No puede superar el área total del local',
          vigenciaDias: 'Un servicio con certificado requiere vigencia en días',
          proyectoId: 'ignorado',
        },
      });
      expect(camposDeErrorServicio(error)).toEqual({
        campos: {
          areaTratar: 'No puede superar el área total del local',
          vigenciaDias: 'Un servicio con certificado requiere vigencia en días',
        },
        general: 'Los datos enviados no son válidos.',
      });
    });

    it('cualquier otro error queda como mensaje general', () => {
      const error = new ErrorApi({ tipo: 'servidor', mensaje: 'El servidor no pudo completar la operación.', status: 500 });
      expect(camposDeErrorServicio(error)).toEqual({ campos: {}, general: 'El servidor no pudo completar la operación.' });
    });
  });
});
