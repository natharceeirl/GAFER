import {
  ActualizarClienteDto,
  ActualizarInsumoDto,
  CambiarEstadoEquipoDto,
  CrearClienteDto,
  CrearEquipoDto,
  CrearInsumoDto,
  CrearPersonalDto,
  CrearProyectoDto,
  CrearServicioContratadoDto,
  GenerarDownloadUrlDto,
  GenerarUploadUrlDto,
} from './mantenimiento.dto';
import { metadatosOpenApi } from '../../../shared/infrastructure/dto/metadatos-openapi.spec-helper';

/** Campos que Swagger debe documentar de cada DTO y cuáles de ellos son obligatorios. */
const documentados: [string, Parameters<typeof metadatosOpenApi>[0], { obligatorios: string[]; opcionales: string[] }][] = [
  [
    'CrearClienteDto',
    CrearClienteDto,
    {
      obligatorios: ['razonSocial', 'ruc', 'codigoCorto', 'direccionFiscal', 'giroNegocio', 'contactoNombre', 'contactoCargo', 'contactoTelefono', 'contactoCorreo'],
      opcionales: ['camposExtra'],
    },
  ],
  [
    'ActualizarClienteDto',
    ActualizarClienteDto,
    {
      obligatorios: [],
      opcionales: ['razonSocial', 'direccionFiscal', 'giroNegocio', 'contactoNombre', 'contactoCargo', 'contactoTelefono', 'contactoCorreo', 'camposExtra'],
    },
  ],
  [
    'CrearProyectoDto',
    CrearProyectoDto,
    {
      obligatorios: ['clienteId', 'nombre', 'direccionSede', 'distrito', 'provincia', 'departamento', 'contactoNombre', 'contactoCargo', 'contactoTelefono'],
      opcionales: ['observaciones'],
    },
  ],
  [
    'CrearServicioContratadoDto',
    CrearServicioContratadoDto,
    {
      obligatorios: ['proyectoId', 'tipoServicio', 'frecuencia', 'areaTotalM2', 'areaTratarM2'],
      opcionales: ['insumosAutorizados', 'equiposAutorizados', 'dosisReferencial', 'requiereCertificado', 'vigenciaDias'],
    },
  ],
  [
    'CrearInsumoDto',
    CrearInsumoDto,
    {
      obligatorios: ['nombreComercial', 'principioActivo', 'presentacion', 'unidadMedida', 'registroDigesa', 'concentracion', 'dosisEstandar', 'fichaTecnicaKey', 'hojaMsdsKey'],
      opcionales: ['resolucionKey', 'proveedor'],
    },
  ],
  [
    'ActualizarInsumoDto',
    ActualizarInsumoDto,
    {
      obligatorios: [],
      opcionales: ['nombreComercial', 'principioActivo', 'presentacion', 'unidadMedida', 'registroDigesa', 'concentracion', 'dosisEstandar', 'fichaTecnicaKey', 'hojaMsdsKey', 'resolucionKey', 'proveedor'],
    },
  ],
  [
    'CrearEquipoDto',
    CrearEquipoDto,
    {
      obligatorios: ['codigoInterno', 'nombre', 'tipo'],
      opcionales: ['estadoOperativo', 'marcaModelo', 'fechaAdquisicion', 'ultimoMantenimiento', 'proximoMantenimiento'],
    },
  ],
  ['CambiarEstadoEquipoDto', CambiarEstadoEquipoDto, { obligatorios: ['estadoOperativo'], opcionales: [] }],
  [
    'CrearPersonalDto',
    CrearPersonalDto,
    { obligatorios: ['dni', 'nombres', 'apellidos', 'cargo', 'telefono'], opcionales: ['usuario'] },
  ],
  ['GenerarUploadUrlDto', GenerarUploadUrlDto, { obligatorios: ['key'], opcionales: ['contentType'] }],
  ['GenerarDownloadUrlDto', GenerarDownloadUrlDto, { obligatorios: ['key'], opcionales: [] }],
];

describe.each(documentados)('Swagger de %s', (_nombre, dto, { obligatorios, opcionales }) => {
  const propiedades = metadatosOpenApi(dto);

  it('documenta cada campo y marca cuáles son obligatorios', () => {
    expect(Object.keys(propiedades).sort()).toEqual([...obligatorios, ...opcionales].sort());
    for (const campo of obligatorios) expect(propiedades[campo].required).toBe(true);
    for (const campo of opcionales) expect(propiedades[campo].required).toBe(false);
  });

  it('describe cada campo y le da un ejemplo', () => {
    for (const [campo, propiedad] of Object.entries(propiedades)) {
      expect({ campo, description: typeof propiedad.description }).toEqual({ campo, description: 'string' });
      expect({ campo, ejemplo: propiedad.example !== undefined }).toEqual({ campo, ejemplo: true });
    }
  });
});

describe('Swagger de los catálogos cerrados', () => {
  it('lista los valores permitidos de cada enum', () => {
    expect(metadatosOpenApi(CrearServicioContratadoDto).tipoServicio.enum).toEqual(['DSF', 'DSS', 'DRT', 'LRA', 'LTG', 'LTS', 'LAM']);
    expect(metadatosOpenApi(CrearInsumoDto).presentacion.enum).toEqual(['LIQUIDO', 'POLVO', 'BLOQUE', 'SOBRE', 'GEL', 'OTRO']);
    expect(metadatosOpenApi(CrearEquipoDto).estadoOperativo.enum).toEqual(['OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO']);
    expect(metadatosOpenApi(CrearPersonalDto).cargo.enum).toEqual(['ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR']);
  });

  it('documenta el formato de los campos con reglas de texto', () => {
    expect(metadatosOpenApi(CrearClienteDto).ruc.pattern).toBe('^\\d{11}$');
    expect(metadatosOpenApi(CrearClienteDto).contactoCorreo.format).toBe('email');
    expect(metadatosOpenApi(CrearProyectoDto).clienteId.format).toBe('uuid');
  });
});
