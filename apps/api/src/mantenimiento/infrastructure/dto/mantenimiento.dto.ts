import {
  CambioEstadoEquipoSchema,
  ClienteActualizacionSchema,
  ClienteRegistroSchema,
  EquipoActualizacionSchema,
  EquipoRegistroSchema,
  GenerarDownloadUrlSchema,
  GenerarUploadUrlSchema,
  InsumoActualizacionSchema,
  InsumoRegistroSchema,
  PersonalActualizacionSchema,
  PersonalRegistroSchema,
  ProyectoActualizacionSchema,
  ProyectoRegistroSchema,
  ServicioContratadoActualizacionSchema,
  ServicioContratadoRegistroSchema,
} from '@gafer/contracts';
import { createZodDtoDocumentado } from '../../../shared/infrastructure/dto/zod-dto-documentado';

export class CrearClienteDto extends createZodDtoDocumentado(ClienteRegistroSchema, {
  razonSocial: 'Kallpa Generacion S.A.',
  ruc: '20508565434',
  codigoCorto: 'KALLPA',
  direccionFiscal: 'Av. Las Palmas 123, Mollendo',
  giroNegocio: 'Generación Eléctrica',
  contactoNombre: 'Carlos Ramos',
  contactoCargo: 'Jefe de SSOMA',
  contactoTelefono: '958123456',
  contactoCorreo: 'cramos@kallpa.pe',
  camposExtra: {},
}) {}

export class ActualizarClienteDto extends createZodDtoDocumentado(ClienteActualizacionSchema, {
  razonSocial: 'Kallpa Generacion S.A.C.',
  direccionFiscal: 'Av. Las Palmas 456, Mollendo',
  giroNegocio: 'Generación Eléctrica y Térmica',
  contactoNombre: 'Carlos Ramos Mejia',
  contactoCargo: 'Gerente SSOMA',
  contactoTelefono: '958999888',
  contactoCorreo: 'cramos_nuevo@kallpa.pe',
  camposExtra: {},
}) {}

export class CrearProyectoDto extends createZodDtoDocumentado(ProyectoRegistroSchema, {
  clienteId: 'c1111111-1111-4111-8111-111111111111',
  nombre: 'PLANTA_SUR',
  direccionSede: 'Carretera Costanera Km 12',
  distrito: 'Mollendo',
  provincia: 'Islay',
  departamento: 'Arequipa',
  contactoNombre: 'Mario Vargas',
  contactoCargo: 'Supervisor de Planta',
  contactoTelefono: '954987654',
  observaciones: 'Requerido pase médico y EPP',
}) {}

export class ActualizarProyectoDto extends createZodDtoDocumentado(ProyectoActualizacionSchema, {
  nombre: 'PLANTA_SUR_MOD',
  direccionSede: 'Carretera Costanera Km 14',
  distrito: 'Mollendo',
  provincia: 'Islay',
  departamento: 'Arequipa',
  contactoNombre: 'Mario Vargas Peña',
  contactoCargo: 'Jefe de Planta',
  contactoTelefono: '954999888',
  observaciones: 'Acceso por garita 2',
}) {}

export class CrearServicioContratadoDto extends createZodDtoDocumentado(ServicioContratadoRegistroSchema, {
  proyectoId: 'a1111111-1111-4111-8111-111111111111',
  tipoServicio: 'DSF',
  frecuencia: 'MENSUAL',
  areaTotalM2: 5000.5,
  areaTratarM2: 3500,
  insumosAutorizados: ['i1111111-1111-4111-8111-111111111111'],
  equiposAutorizados: ['e1111111-1111-4111-8111-111111111111'],
  dosisReferencial: { 'i1111111-1111-4111-8111-111111111111': '5 ml / Litro de agua' },
  requiereCertificado: true,
  vigenciaDias: 30,
}) {}

export class ActualizarServicioContratadoDto extends createZodDtoDocumentado(ServicioContratadoActualizacionSchema, {
  frecuencia: 'BIMESTRAL',
  areaTotalM2: 6000,
  areaTratarM2: 4000,
  insumosAutorizados: ['i1111111-1111-4111-8111-111111111111'],
  equiposAutorizados: ['e1111111-1111-4111-8111-111111111111'],
  dosisReferencial: { 'i1111111-1111-4111-8111-111111111111': '10 ml / Litro de agua' },
  requiereCertificado: true,
  vigenciaDias: 60,
}) {}

export class CrearInsumoDto extends createZodDtoDocumentado(InsumoRegistroSchema, {
  nombreComercial: 'Cipermetrina 25%',
  principioActivo: 'Cipermetrina',
  presentacion: 'LIQUIDO',
  unidadMedida: 'L',
  registroDigesa: 'RD-1425-2024/DIGESA/SA',
  concentracion: '25% p/v',
  dosisEstandar: '5 ml / Litro de agua',
  fichaTecnicaKey: 'insumos/fichas/cipermetrina-25.pdf',
  hojaMsdsKey: 'insumos/msds/cipermetrina-25.pdf',
  resolucionKey: 'insumos/resoluciones/rd-1425.pdf',
  proveedor: 'Bayer S.A.',
}) {}

export class ActualizarInsumoDto extends createZodDtoDocumentado(InsumoActualizacionSchema, {
  nombreComercial: 'Cipermetrina 50% Ultra Concentrada (REFORMULADO 2028)',
  principioActivo: 'Cipermetrina Pura',
  presentacion: 'LIQUIDO',
  unidadMedida: 'L',
  registroDigesa: 'RD-9999-2028/DIGESA/SA',
  concentracion: '50% p/v',
  dosisEstandar: '2.5 ml/L',
  fichaTecnicaKey: 'insumos/fichas/cipermetrina-50.pdf',
  hojaMsdsKey: 'insumos/msds/cipermetrina-50.pdf',
  resolucionKey: 'insumos/resoluciones/rd-9999.pdf',
  proveedor: 'Bayer S.A.',
}) {}

export class CrearEquipoDto extends createZodDtoDocumentado(EquipoRegistroSchema, {
  codigoInterno: 'EQ-NEB-01',
  nombre: 'Nebulizadora ULV Vector Fog C-150',
  tipo: 'NEBULIZACION',
  marcaModelo: 'Vector Fog C-150',
  estadoOperativo: 'OPERATIVO',
  fechaAdquisicion: '2026-01-15',
  ultimoMantenimiento: '2026-06-01',
  proximoMantenimiento: '2026-12-01',
}) {}

export class CambiarEstadoEquipoDto extends createZodDtoDocumentado(CambioEstadoEquipoSchema, {
  estadoOperativo: 'MANTENIMIENTO',
}) {}

export class ActualizarEquipoDto extends createZodDtoDocumentado(EquipoActualizacionSchema, {
  nombre: 'Nebulizadora ULV Vector Fog C-150 Plus',
  marcaModelo: 'Vector Fog C-150+',
  estadoOperativo: 'MANTENIMIENTO',
  ultimoMantenimiento: '2026-09-01',
  proximoMantenimiento: '2027-03-01',
}) {}

export class CrearPersonalDto extends createZodDtoDocumentado(PersonalRegistroSchema, {
  dni: '45892312',
  nombres: 'Juan',
  apellidos: 'Perez Gomez',
  cargo: 'TECNICO_OPERADOR',
  telefono: '958123456',
  usuario: 'JPEREZ',
}) {}

export class ActualizarPersonalDto extends createZodDtoDocumentado(PersonalActualizacionSchema, {
  nombres: 'Juan Carlos',
  apellidos: 'Perez Gomez',
  cargo: 'SUPERVISOR',
  telefono: '958999111',
}) {}

export class GenerarUploadUrlDto extends createZodDtoDocumentado(GenerarUploadUrlSchema, {
  key: 'insumos/fichas/ficha-cipermetrina.pdf',
  contentType: 'application/pdf',
}) {}

export class GenerarDownloadUrlDto extends createZodDtoDocumentado(GenerarDownloadUrlSchema, {
  key: 'insumos/fichas/ficha-cipermetrina.pdf',
}) {}
