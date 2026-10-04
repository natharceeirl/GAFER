import {
  ActualizarCatalogoTextoDto,
  ActualizarClienteDto,
  ActualizarConfiguracionDto,
  ActualizarInsumoDto,
  AgregarItemCatalogoTextoDto,
  CambiarEstadoEquipoDto,
  ConsultaAuditoriaDto,
  CrearClienteDto,
  CrearEquipoDto,
  CrearInsumoDto,
  CrearPersonalDto,
  CrearProyectoDto,
  CrearServicioContratadoDto,
  GenerarDownloadUrlDto,
  GenerarUploadUrlDto,
} from './mantenimiento.dto';
import { rutasRechazadas, validarDto } from '../../../shared/infrastructure/dto/validar-dto.spec-helper';

const uuid = 'c1111111-1111-4111-8111-111111111111';

const cliente = {
  razonSocial: 'Kallpa Generacion S.A.',
  ruc: '20508565434',
  codigoCorto: 'KALLPA',
  direccionFiscal: 'Av. Las Palmas 123, Mollendo',
  giroNegocio: 'Generación Eléctrica',
  contactoNombre: 'Carlos Ramos',
  contactoCargo: 'Jefe de SSOMA',
  contactoTelefono: '958123456',
  contactoCorreo: 'cramos@kallpa.pe',
};

const proyecto = {
  clienteId: uuid,
  nombre: 'PLANTA_SUR',
  direccionSede: 'Carretera Costanera Km 12',
  distrito: 'Mollendo',
  provincia: 'Islay',
  departamento: 'Arequipa',
  contactoNombre: 'Mario Vargas',
  contactoCargo: 'Supervisor de Planta',
  contactoTelefono: '954987654',
};

const servicio = {
  proyectoId: uuid,
  tipoServicio: 'DSF',
  frecuencia: 'MENSUAL',
  areaTotalM2: 5000.5,
  areaTratarM2: 3500,
  requiereCertificado: true,
  vigenciaDias: 30,
};

const insumo = {
  nombreComercial: 'Cipermetrina 25%',
  principioActivo: 'Cipermetrina',
  presentacion: 'LIQUIDO',
  unidadMedida: 'L',
  registroDigesa: 'RD-1425-2024/DIGESA/SA',
  concentracion: '25% p/v',
  dosisEstandar: '5 ml / Litro de agua',
  fichaTecnicaKey: 'insumos/fichas/cipermetrina-25.pdf',
  hojaMsdsKey: 'insumos/msds/cipermetrina-25.pdf',
};

const equipo = { codigoInterno: 'EQ-NEB-01', nombre: 'Nebulizadora ULV Vector Fog C-150', tipo: 'NEBULIZACION', estadoOperativo: 'OPERATIVO' };

const personal = { dni: '45892312', nombres: 'Juan', apellidos: 'Perez Gomez', cargo: 'TECNICO_OPERADOR', telefono: '958123456' };

describe('CrearClienteDto', () => {
  it('acepta un cliente válido y descarta los campos que no declara', () => {
    expect(validarDto(CrearClienteDto, { ...cliente, camposExtra: { sector: 'energía' }, intruso: 1 })).toEqual({
      ...cliente,
      camposExtra: { sector: 'energía' },
    });
  });

  it('rechaza un RUC que no tiene 11 dígitos', () => {
    expect(rutasRechazadas(CrearClienteDto, { ...cliente, ruc: '2050856' })).toEqual(['ruc']);
  });

  it.each(['KAL', 'kallpa', 'SAMAY_1', 'KALLPAENERGIA'])('rechaza el código corto %j (4 a 10 letras o números en mayúsculas)', (codigoCorto) => {
    expect(rutasRechazadas(CrearClienteDto, { ...cliente, codigoCorto })).toEqual(['codigoCorto']);
  });

  it('rechaza correo inválido, campos vacíos y camposExtra que no es un objeto', () => {
    expect(rutasRechazadas(CrearClienteDto, { ...cliente, contactoCorreo: 'sin-arroba' })).toEqual(['contactoCorreo']);
    expect(rutasRechazadas(CrearClienteDto, { ...cliente, razonSocial: '' })).toEqual(['razonSocial']);
    expect(rutasRechazadas(CrearClienteDto, { ...cliente, camposExtra: 'x' })).toEqual(['camposExtra']);
  });

  it('informa cada campo que falta', () => {
    expect(rutasRechazadas(CrearClienteDto, {})).toEqual([
      'razonSocial', 'ruc', 'codigoCorto', 'direccionFiscal', 'giroNegocio', 'contactoNombre', 'contactoCargo', 'contactoTelefono', 'contactoCorreo',
    ]);
  });
});

describe('ActualizarClienteDto', () => {
  it('acepta un cuerpo vacío o parcial y descarta el RUC y el código corto', () => {
    expect(validarDto(ActualizarClienteDto, {})).toEqual({});
    expect(validarDto(ActualizarClienteDto, { razonSocial: 'Kallpa S.A.C.', ruc: '20508565434', codigoCorto: 'OTRO' })).toEqual({
      razonSocial: 'Kallpa S.A.C.',
    });
  });

  it('rechaza valores vacíos o inválidos en los campos que llegan', () => {
    expect(rutasRechazadas(ActualizarClienteDto, { razonSocial: '' })).toEqual(['razonSocial']);
    expect(rutasRechazadas(ActualizarClienteDto, { contactoCorreo: 'sin-arroba' })).toEqual(['contactoCorreo']);
  });
});

describe('CrearProyectoDto', () => {
  it('acepta una sede válida', () => expect(validarDto(CrearProyectoDto, proyecto)).toEqual(proyecto));

  it('rechaza un cliente que no es UUID', () => {
    expect(rutasRechazadas(CrearProyectoDto, { ...proyecto, clienteId: 'c1' })).toEqual(['clienteId']);
  });

  it.each(['AB', 'PLANTA SUR', 'planta_sur', 'PLANTA_SUR_MOLLENDO_2026'])('rechaza el nombre %j (4 a 20 caracteres en mayúsculas, sin espacios)', (nombre) => {
    expect(rutasRechazadas(CrearProyectoDto, { ...proyecto, nombre })).toEqual(['nombre']);
  });

  it('rechaza un teléfono de menos de 6 dígitos y una dirección vacía', () => {
    expect(rutasRechazadas(CrearProyectoDto, { ...proyecto, contactoTelefono: '12345' })).toEqual(['contactoTelefono']);
    expect(rutasRechazadas(CrearProyectoDto, { ...proyecto, direccionSede: '' })).toEqual(['direccionSede']);
  });
});

describe('CrearServicioContratadoDto', () => {
  it('acepta un servicio válido, con o sin certificado', () => {
    expect(validarDto(CrearServicioContratadoDto, servicio)).toEqual(servicio);
    const { vigenciaDias: _v, requiereCertificado: _r, ...sinCertificado } = servicio;
    expect(validarDto(CrearServicioContratadoDto, sinCertificado)).toEqual(sinCertificado);
  });

  it('rechaza un tipo de servicio o una frecuencia fuera del catálogo', () => {
    expect(rutasRechazadas(CrearServicioContratadoDto, { ...servicio, tipoServicio: 'XXX' })).toEqual(['tipoServicio']);
    expect(rutasRechazadas(CrearServicioContratadoDto, { ...servicio, frecuencia: 'HORARIA' })).toEqual(['frecuencia']);
  });

  it('rechaza áreas que no son positivas', () => {
    expect(rutasRechazadas(CrearServicioContratadoDto, { ...servicio, areaTotalM2: 0, areaTratarM2: 0 })).toEqual(['areaTotalM2', 'areaTratarM2']);
  });

  it('rechaza un área a tratar mayor que el área total', () => {
    expect(rutasRechazadas(CrearServicioContratadoDto, { ...servicio, areaTratarM2: 6000 })).toEqual(['areaTratarM2']);
  });

  it('exige vigencia cuando el servicio emite certificado', () => {
    const { vigenciaDias: _v, ...sinVigencia } = servicio;
    expect(rutasRechazadas(CrearServicioContratadoDto, sinVigencia)).toEqual(['vigenciaDias']);
    expect(rutasRechazadas(CrearServicioContratadoDto, { ...servicio, vigenciaDias: 0 })).toEqual(['vigenciaDias']);
  });
});

describe('CrearInsumoDto', () => {
  it('acepta un insumo válido con campos opcionales', () => {
    expect(validarDto(CrearInsumoDto, insumo)).toEqual(insumo);
    expect(validarDto(CrearInsumoDto, { ...insumo, proveedor: 'Bayer S.A.', resolucionKey: 'insumos/resoluciones/rd-1425.pdf' })).toMatchObject({
      proveedor: 'Bayer S.A.',
    });
  });

  it('rechaza presentación o unidad fuera del catálogo y textos vacíos', () => {
    expect(rutasRechazadas(CrearInsumoDto, { ...insumo, presentacion: 'ESPUMA' })).toEqual(['presentacion']);
    expect(rutasRechazadas(CrearInsumoDto, { ...insumo, unidadMedida: 'LITRO' })).toEqual(['unidadMedida']);
    expect(rutasRechazadas(CrearInsumoDto, { ...insumo, registroDigesa: '' })).toEqual(['registroDigesa']);
  });
});

describe('ActualizarInsumoDto', () => {
  it('acepta un cuerpo parcial y descarta los campos que no declara', () => {
    expect(validarDto(ActualizarInsumoDto, { concentracion: '50% p/v', estado: 'INACTIVO' })).toEqual({ concentracion: '50% p/v' });
  });

  it('rechaza valores vacíos o fuera del catálogo', () => {
    expect(rutasRechazadas(ActualizarInsumoDto, { nombreComercial: '' })).toEqual(['nombreComercial']);
    expect(rutasRechazadas(ActualizarInsumoDto, { presentacion: 'ESPUMA' })).toEqual(['presentacion']);
  });
});

describe('CrearEquipoDto', () => {
  it('acepta un equipo válido', () => {
    expect(validarDto(CrearEquipoDto, { ...equipo, marcaModelo: 'Vector Fog C-150' })).toEqual({ ...equipo, marcaModelo: 'Vector Fog C-150' });
  });

  it('acepta un equipo sin estado operativo (parte como OPERATIVO)', () => {
    const { estadoOperativo: _e, ...sinEstado } = equipo;
    expect(validarDto(CrearEquipoDto, sinEstado)).toEqual(sinEstado);
  });

  it('rechaza un tipo o un estado fuera del catálogo y un código vacío', () => {
    expect(rutasRechazadas(CrearEquipoDto, { ...equipo, tipo: 'TRACTOR' })).toEqual(['tipo']);
    expect(rutasRechazadas(CrearEquipoDto, { ...equipo, estadoOperativo: 'ROTO' })).toEqual(['estadoOperativo']);
    expect(rutasRechazadas(CrearEquipoDto, { ...equipo, codigoInterno: '' })).toEqual(['codigoInterno']);
  });
});

describe('CambiarEstadoEquipoDto', () => {
  it('acepta un estado operativo del catálogo', () => {
    expect(validarDto(CambiarEstadoEquipoDto, { estadoOperativo: 'MANTENIMIENTO' })).toEqual({ estadoOperativo: 'MANTENIMIENTO' });
  });
  it('rechaza un estado desconocido o ausente', () => {
    expect(rutasRechazadas(CambiarEstadoEquipoDto, { estadoOperativo: 'ROTO' })).toEqual(['estadoOperativo']);
    expect(rutasRechazadas(CambiarEstadoEquipoDto, {})).toEqual(['estadoOperativo']);
  });
});

describe('CrearPersonalDto', () => {
  it('acepta un miembro del personal válido, con usuario opcional', () => {
    expect(validarDto(CrearPersonalDto, { ...personal, usuario: 'JPEREZ' })).toEqual({ ...personal, usuario: 'JPEREZ' });
  });

  it('rechaza un DNI que no tiene 8 dígitos y un cargo desconocido', () => {
    expect(rutasRechazadas(CrearPersonalDto, { ...personal, dni: '4589231' })).toEqual(['dni']);
    expect(rutasRechazadas(CrearPersonalDto, { ...personal, cargo: 'GERENTE' })).toEqual(['cargo']);
  });
});

describe('GenerarUploadUrlDto y GenerarDownloadUrlDto', () => {
  const key = 'insumos/fichas/ficha-cipermetrina.pdf';

  it('aceptan la clave del archivo', () => {
    expect(validarDto(GenerarUploadUrlDto, { key, contentType: 'application/pdf' })).toEqual({ key, contentType: 'application/pdf' });
    expect(validarDto(GenerarDownloadUrlDto, { key })).toEqual({ key });
  });

  it('rechazan una clave vacía', () => {
    expect(rutasRechazadas(GenerarUploadUrlDto, { key: '' })).toEqual(['key']);
    expect(rutasRechazadas(GenerarDownloadUrlDto, { key: '' })).toEqual(['key']);
  });
});

describe('ActualizarCatalogoTextoDto y AgregarItemCatalogoTextoDto', () => {
  it('valida actualización de catálogo con lista de items válidos', () => {
    expect(validarDto(ActualizarCatalogoTextoDto, { items: ['CUCARACHA', 'MOSCA'] })).toEqual({
      items: ['CUCARACHA', 'MOSCA'],
    });
  });

  it('rechaza catálogo con items vacíos', () => {
    expect(rutasRechazadas(ActualizarCatalogoTextoDto, { items: [''] })).toEqual(['items.0']);
  });

  it('valida agregar item individual', () => {
    expect(validarDto(AgregarItemCatalogoTextoDto, { item: 'ROEDOR' })).toEqual({ item: 'ROEDOR' });
  });

  it('rechaza agregar item vacío', () => {
    expect(rutasRechazadas(AgregarItemCatalogoTextoDto, { item: '' })).toEqual(['item']);
  });
});

describe('ActualizarConfiguracionDto', () => {
  it('acepta actualización de director y resolución', () => {
    expect(
      validarDto(ActualizarConfiguracionDto, {
        director: { nombre: 'Ing. Carlos Medina', cip: '84512' },
        resolucionSanitaria: '0023-2024-DESA/MINSA',
      }),
    ).toEqual({
      director: { nombre: 'Ing. Carlos Medina', cip: '84512' },
      resolucionSanitaria: '0023-2024-DESA/MINSA',
    });
  });

  it('rechaza CIP con formato inválido', () => {
    expect(
      rutasRechazadas(ActualizarConfiguracionDto, {
        director: { nombre: 'Carlos', cip: '12' },
      }),
    ).toEqual(['director.cip']);
  });
});

describe('ConsultaAuditoriaDto', () => {
  it('acepta filtros de auditoría válidos y aplica defaults de paginación', () => {
    expect(
      validarDto(ConsultaAuditoriaDto, {
        modulo: 'MANTENIMIENTO',
        actorUsuario: 'ADMIN',
      }),
    ).toEqual({
      modulo: 'MANTENIMIENTO',
      actorUsuario: 'ADMIN',
      limit: 20,
      offset: 0,
    });
  });

  it('rechaza módulo desconocido o límite fuera de rango', () => {
    expect(rutasRechazadas(ConsultaAuditoriaDto, { modulo: 'MODULO_FALSO' })).toEqual(['modulo']);
    expect(rutasRechazadas(ConsultaAuditoriaDto, { limit: 200 })).toEqual(['limit']);
  });
});
