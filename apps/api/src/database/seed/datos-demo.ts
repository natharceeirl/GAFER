/**
 * datos-demo.ts
 * Datos de EJEMPLO para la demo H1 y el entorno de QA (GAF-94). Son ficticios: no corresponden a clientes,
 * sedes, equipos ni insumos reales de GAFER. Este archivo es la fuente de verdad del seed y de su limpieza:
 * `db:seed:demo --limpiar` borra únicamente lo que se declara aquí, por sus claves naturales.
 *
 * Claves naturales (con ellas el seed es idempotente y la limpieza sabe qué filas son suyas):
 *   cliente → codigoCorto (prefijo DEMO) y RUC · sede → cliente + nombre · servicio → sede + tipo
 *   insumo → registroDigesa (prefijo DEMO-) · equipo → codigoInterno (prefijo EQ-DEMO-) · persona → DNI + usuario
 *
 * Aquí NO hay claves: las genera `db:seed:demo` al azar en cada instalación y las imprime una sola vez.
 *
 * Historial de versiones
 *   v1.0  2026-10-08  ihuayhuam  Creación del archivo (GAF-94).
 */
import type {
  CatalogoTextoId,
  ClienteRegistro,
  DirectorTecnico,
  EquipoRegistro,
  FrecuenciaServicio,
  InsumoRegistro,
  PersonalRegistro,
  ProyectoRegistro,
  TipoServicio,
} from '@gafer/contracts';

export type SedeDemo = Omit<ProyectoRegistro, 'clienteId'> & { clienteCodigo: string };

/** Servicio de una sede; insumos y equipos se refieren por su clave natural y la siembra los traduce a ids. */
export interface ServicioDemo {
  clienteCodigo: string;
  sede: string;
  tipoServicio: TipoServicio;
  frecuencia: FrecuenciaServicio;
  areaTotalM2: number;
  areaTratarM2: number;
  /** Registros DIGESA (claves naturales) de los insumos autorizados. */
  insumos: string[];
  /** Códigos internos de los equipos autorizados. */
  equipos: string[];
  /** Dosis referencial por registro DIGESA del insumo. */
  dosisReferencial: Record<string, string>;
  requiereCertificado: boolean;
  vigenciaDias: number | null;
}

export type PersonalDemo = PersonalRegistro & { usuario: string };

export interface DatosDemo {
  clientes: ClienteRegistro[];
  sedes: SedeDemo[];
  servicios: ServicioDemo[];
  insumos: InsumoRegistro[];
  equipos: EquipoRegistro[];
  personal: PersonalDemo[];
  /** Textos que se AGREGAN a los catálogos que ya siembran las migraciones (no los reemplazan). */
  catalogos: Partial<Record<CatalogoTextoId, string[]>>;
  directorTecnico: DirectorTecnico;
}

const PROVEEDOR = 'Proveedor de Ejemplo S.A.C.';

function insumo(
  n: number,
  nombreComercial: string,
  principioActivo: string,
  presentacion: InsumoRegistro['presentacion'],
  unidadMedida: InsumoRegistro['unidadMedida'],
  concentracion: string,
  dosisEstandar: string,
): InsumoRegistro {
  const registro = `DEMO-DIG-${String(n).padStart(3, '0')}`;
  return {
    nombreComercial,
    principioActivo,
    presentacion,
    unidadMedida,
    registroDigesa: registro,
    concentracion,
    dosisEstandar,
    fichaTecnicaKey: `demo/insumos/${registro}/ficha-tecnica.pdf`,
    hojaMsdsKey: `demo/insumos/${registro}/hoja-msds.pdf`,
    resolucionKey: null,
    proveedor: PROVEEDOR,
  };
}

const INSUMOS: InsumoRegistro[] = [
  insumo(1, 'DemoCiper 25 EC', 'Cipermetrina', 'LIQUIDO', 'L', '25 % p/v', '10 ml por litro de agua'),
  insumo(2, 'DemoRaticida Bloque B', 'Brodifacoum', 'BLOQUE', 'BLOQUE', '0.005 %', '1 bloque (20 g) por estación'),
  insumo(3, 'DemoRaticida Bloque M', 'Bromadiolona', 'BLOQUE', 'BLOQUE', '0.005 %', '1 bloque (20 g) por estación'),
  insumo(4, 'DemoDelta PM 5', 'Deltametrina', 'POLVO', 'KG', '5 % p/p', '2 g por litro de agua'),
  insumo(5, 'DemoGel Cucaracha', 'Imidacloprid', 'GEL', 'G', '2.15 % p/p', '1 g por punto de aplicación'),
  insumo(6, 'DemoCloro 5', 'Hipoclorito de sodio', 'LIQUIDO', 'L', '5 % p/v', '5 ml por litro de agua'),
  insumo(7, 'DemoQuat 10', 'Cloruro de didecildimetilamonio', 'LIQUIDO', 'L', '10 % p/v', '5 ml por litro de agua'),
  insumo(8, 'DemoLambda 10 CS', 'Lambda-cihalotrina', 'LIQUIDO', 'ML', '10 % p/v', '4 ml por litro de agua'),
  insumo(9, 'DemoHormiga Gel', 'Fipronil', 'GEL', 'G', '0.05 % p/p', '0.5 g por punto de aplicación'),
  insumo(10, 'DemoOxi 50', 'Peróxido de hidrógeno', 'LIQUIDO', 'L', '50 % p/v', '20 ml por litro de agua'),
  insumo(11, 'DemoEnzima Grasa', 'Consorcio enzimático de Bacillus spp.', 'POLVO', 'KG', '1 x 10^9 UFC/g', '50 g por m³ de agua residual'),
  insumo(12, 'DemoLarvicida Bti', 'Bacillus thuringiensis israelensis', 'SOBRE', 'SOBRE', '1200 UTI/mg', '1 sobre por 20 m² de agua estancada'),
];

const [CIPER, BRODI, BROMA, DELTA, IMIDA, HIPO, CUAT, LAMBDA, FIPRO, PEROX, ENZIM, BTI] = INSUMOS.map(
  (i) => i.registroDigesa,
);

function equipo(
  n: number,
  nombre: string,
  tipo: EquipoRegistro['tipo'],
  marcaModelo: string,
  estadoOperativo: NonNullable<EquipoRegistro['estadoOperativo']>,
  fechas: { adquisicion: string; ultimo: string; proximo: string },
): EquipoRegistro {
  return {
    codigoInterno: `EQ-DEMO-${String(n).padStart(3, '0')}`,
    nombre,
    tipo,
    marcaModelo,
    estadoOperativo,
    fechaAdquisicion: fechas.adquisicion,
    ultimoMantenimiento: fechas.ultimo,
    proximoMantenimiento: fechas.proximo,
  };
}

const EQUIPOS: EquipoRegistro[] = [
  equipo(1, 'Motomochila fumigadora 20 L', 'FUMIGACION', 'Ejemplo MF-20', 'OPERATIVO', { adquisicion: '2024-03-15', ultimo: '2026-08-20', proximo: '2026-11-20' }),
  equipo(2, 'Nebulizador ULV portátil', 'NEBULIZACION', 'Ejemplo ULV-100', 'OPERATIVO', { adquisicion: '2024-05-10', ultimo: '2026-07-15', proximo: '2026-10-15' }),
  equipo(3, 'Aspersora manual 10 L', 'ASPERSION', 'Ejemplo AM-10', 'OPERATIVO', { adquisicion: '2023-11-02', ultimo: '2026-06-30', proximo: '2026-12-30' }),
  equipo(4, 'Aspersora manual 20 L', 'ASPERSION', 'Ejemplo AM-20', 'OPERATIVO', { adquisicion: '2023-11-02', ultimo: '2026-06-30', proximo: '2026-12-30' }),
  equipo(5, 'Hidrolavadora industrial', 'LIMPIEZA', 'Ejemplo HL-2500', 'OPERATIVO', { adquisicion: '2025-01-20', ultimo: '2026-09-01', proximo: '2027-03-01' }),
  equipo(6, 'Aspiradora industrial de sólidos y líquidos', 'LIMPIEZA', 'Ejemplo AS-80', 'FUERA_SERVICIO', { adquisicion: '2022-08-12', ultimo: '2026-02-10', proximo: '2026-08-10' }),
  equipo(7, 'Bomba de succión de lodos', 'LIMPIEZA', 'Ejemplo BL-300', 'OPERATIVO', { adquisicion: '2024-09-05', ultimo: '2026-08-05', proximo: '2027-02-05' }),
  equipo(8, 'Termohigrómetro digital', 'MEDICION', 'Ejemplo TH-10', 'OPERATIVO', { adquisicion: '2025-06-18', ultimo: '2026-06-18', proximo: '2027-06-18' }),
  equipo(9, 'Medidor de cloro residual', 'MEDICION', 'Ejemplo MC-5', 'MANTENIMIENTO', { adquisicion: '2025-02-14', ultimo: '2026-09-25', proximo: '2026-12-25' }),
  equipo(10, 'Kit de protección personal (respirador, guantes y lentes)', 'PROTECCION', 'Ejemplo KP-1', 'OPERATIVO', { adquisicion: '2025-03-03', ultimo: '2026-09-03', proximo: '2027-03-03' }),
  equipo(11, 'Cámara de inspección de tuberías', 'OTRO', 'Ejemplo CT-20', 'OPERATIVO', { adquisicion: '2025-10-27', ultimo: '2026-04-27', proximo: '2026-10-27' }),
];

const [MOTOMOCHILA, NEBULIZADOR, ASPERSORA_10, ASPERSORA_20, HIDROLAVADORA, , BOMBA_LODOS, TERMOHIGROMETRO, MEDIDOR_CLORO, KIT_EPP, CAMARA] =
  EQUIPOS.map((e) => e.codigoInterno);

function dosisDe(registros: string[]): Record<string, string> {
  return Object.fromEntries(
    registros.map((registro) => [registro, INSUMOS.find((i) => i.registroDigesa === registro)?.dosisEstandar ?? '']),
  );
}

interface RecursosServicio {
  insumos?: string[];
  equipos?: string[];
  /** Si el servicio emite certificado, su vigencia en días. */
  certificadoDias?: number;
}

function servicio(
  clienteCodigo: string,
  sede: string,
  tipoServicio: TipoServicio,
  frecuencia: FrecuenciaServicio,
  areaTotalM2: number,
  areaTratarM2: number,
  recursos: RecursosServicio = {},
): ServicioDemo {
  const insumos = recursos.insumos ?? [];
  return {
    clienteCodigo,
    sede,
    tipoServicio,
    frecuencia,
    areaTotalM2,
    areaTratarM2,
    insumos,
    equipos: recursos.equipos ?? [],
    dosisReferencial: dosisDe(insumos),
    requiereCertificado: recursos.certificadoDias !== undefined,
    vigenciaDias: recursos.certificadoDias ?? null,
  };
}

interface DatosContacto {
  nombre: string;
  cargo: string;
  telefono: string;
}

function sede(
  clienteCodigo: string,
  nombre: string,
  direccionSede: string,
  ubicacion: { distrito: string; provincia: string; departamento: string },
  contacto: DatosContacto,
  observaciones: string | null = null,
): SedeDemo {
  return {
    clienteCodigo,
    nombre,
    direccionSede,
    ...ubicacion,
    contactoNombre: contacto.nombre,
    contactoCargo: contacto.cargo,
    contactoTelefono: contacto.telefono,
    observaciones,
  };
}

function cliente(
  codigoCorto: string,
  razonSocial: string,
  ruc: string,
  direccionFiscal: string,
  giroNegocio: string,
  contacto: DatosContacto & { correo: string },
): ClienteRegistro {
  return {
    razonSocial,
    ruc,
    codigoCorto,
    direccionFiscal,
    giroNegocio,
    contactoNombre: contacto.nombre,
    contactoCargo: contacto.cargo,
    contactoTelefono: contacto.telefono,
    contactoCorreo: contacto.correo,
  };
}

const PAMPA = 'DEMOPAMPA';
const ANDES = 'DEMOANDES';
const SALUD = 'DEMOSALUD';
const RETAIL = 'DEMORETAIL';
const EDUCA = 'DEMOEDUCA';
const HOTEL = 'DEMOHOTEL';
const LOGIS = 'DEMOLOGIS';
const AGRO = 'DEMOAGRO';
const FARMA = 'DEMOFARMA';
const ENERGIA = 'DEMOENERG';
const MUNI = 'DEMOMUNI';
const RESTO = 'DEMORESTO';

export const DATOS_DEMO: DatosDemo = {
  // RUC ficticios (rango 2099...) con dígito verificador válido; no son de empresas reales.
  clientes: [
    cliente(PAMPA, 'Conservas Pampa Demo S.A.C.', '20991070011', 'Av. Ejemplo 100, Ate, Lima', 'Alimentos', { nombre: 'Rosa Paredes', cargo: 'Jefa de Calidad', telefono: '955010101', correo: 'calidad.pampa@example.com' }),
    cliente(ANDES, 'Minera Cerro Alto Demo S.A.', '20991140027', 'Calle Ejemplo 210, Cayma, Arequipa', 'Minería', { nombre: 'Julio Ccama', cargo: 'Superintendente de Seguridad', telefono: '955010102', correo: 'seguridad.cerroalto@example.com' }),
    cliente(SALUD, 'Clínica San Ejemplo Demo S.A.C.', '20991210033', 'Av. Ejemplo 320, San Isidro, Lima', 'Salud', { nombre: 'Carmen Valdivia', cargo: 'Jefa de Servicios Generales', telefono: '955010103', correo: 'servicios.sanejemplo@example.com' }),
    cliente(RETAIL, 'Supermercados Ejemplo Demo S.A.', '20991280040', 'Av. Ejemplo 450, Miraflores, Lima', 'Retail', { nombre: 'Miguel Soto', cargo: 'Gerente de Operaciones', telefono: '955010104', correo: 'operaciones.superejemplo@example.com' }),
    cliente(EDUCA, 'Colegio Horizonte Demo E.I.R.L.', '20991350056', 'Jr. Ejemplo 560, Santiago de Surco, Lima', 'Educación', { nombre: 'Elena Quispe', cargo: 'Directora Administrativa', telefono: '955010105', correo: 'administracion.horizonte@example.com' }),
    cliente(HOTEL, 'Hotel Mirador Demo S.A.C.', '20991420062', 'Av. Ejemplo 670, Cusco', 'Hotelería', { nombre: 'Pedro Huamán', cargo: 'Gerente General', telefono: '955010106', correo: 'gerencia.mirador@example.com' }),
    cliente(LOGIS, 'Transportes Rápido Demo S.A.C.', '20991490079', 'Av. Ejemplo 780, Callao', 'Transporte', { nombre: 'Sofía Linares', cargo: 'Jefa de Flota', telefono: '955010107', correo: 'flota.rapido@example.com' }),
    cliente(AGRO, 'Agroexportadora Valle Verde Demo S.A.C.', '20991560085', 'Carretera Ejemplo km 12, Ica', 'Agroindustria', { nombre: 'Daniel Rojas', cargo: 'Jefe de Inocuidad', telefono: '955010108', correo: 'inocuidad.vallev@example.com' }),
    cliente(FARMA, 'Laboratorios Vida Demo S.A.', '20991630091', 'Av. Ejemplo 890, Lurín, Lima', 'Farmacéutica', { nombre: 'Patricia Neyra', cargo: 'Directora Técnica', telefono: '955010109', correo: 'tecnica.vidademo@example.com' }),
    cliente(ENERGIA, 'Energía Solar Norte Demo S.A.C.', '20991700103', 'Av. Ejemplo 910, Piura', 'Energía', { nombre: 'Luis Chávez', cargo: 'Jefe de Planta', telefono: '955010110', correo: 'planta.solarnorte@example.com' }),
    cliente(MUNI, 'Municipalidad Distrital de Ejemplo (Demo)', '20991770110', 'Plaza Ejemplo s/n, Huancayo, Junín', 'Sector público', { nombre: 'Gloria Camposano', cargo: 'Gerente de Servicios Públicos', telefono: '955010111', correo: 'servicios.muniejemplo@example.com' }),
    cliente(RESTO, 'Restaurantes Sabor Demo S.A.C.', '20991840126', 'Calle Ejemplo 120, Trujillo, La Libertad', 'Restaurantes', { nombre: 'Andrés Vargas', cargo: 'Administrador', telefono: '955010112', correo: 'admin.sabordemo@example.com' }),
  ],

  sedes: [
    sede(PAMPA, 'PLANTA_ATE', 'Av. Ejemplo 100, Ate', { distrito: 'Ate', provincia: 'Lima', departamento: 'Lima' }, { nombre: 'Hugo Ríos', cargo: 'Jefe de Planta', telefono: '955020101' }, 'Ingreso con casco y calzado de seguridad.'),
    sede(PAMPA, 'ALMACEN_CALLAO', 'Jr. Ejemplo 55, Callao', { distrito: 'Callao', provincia: 'Callao', departamento: 'Callao' }, { nombre: 'Marta Ortiz', cargo: 'Jefa de Almacén', telefono: '955020102' }),
    sede(ANDES, 'CAMPAMENTO_BASE', 'Km 45 Carretera Ejemplo, Caylloma', { distrito: 'Caylloma', provincia: 'Caylloma', departamento: 'Arequipa' }, { nombre: 'Raúl Mamani', cargo: 'Administrador de Campamento', telefono: '955020103' }, 'Requiere inducción de seguridad previa al ingreso.'),
    sede(ANDES, 'COMEDOR_MINA', 'Km 46 Carretera Ejemplo, Caylloma', { distrito: 'Caylloma', provincia: 'Caylloma', departamento: 'Arequipa' }, { nombre: 'Teresa Flores', cargo: 'Jefa de Comedor', telefono: '955020104' }),
    sede(SALUD, 'CLINICA_CENTRAL', 'Av. Ejemplo 320, San Isidro', { distrito: 'San Isidro', provincia: 'Lima', departamento: 'Lima' }, { nombre: 'Carmen Valdivia', cargo: 'Jefa de Servicios Generales', telefono: '955020105' }, 'Coordinar el acceso a áreas críticas con Epidemiología.'),
    sede(SALUD, 'LABORATORIO', 'Av. Ejemplo 322, San Isidro', { distrito: 'San Isidro', provincia: 'Lima', departamento: 'Lima' }, { nombre: 'Walter Lazo', cargo: 'Jefe de Laboratorio', telefono: '955020106' }),
    sede(RETAIL, 'TIENDA_MIRAFLORES', 'Av. Ejemplo 450, Miraflores', { distrito: 'Miraflores', provincia: 'Lima', departamento: 'Lima' }, { nombre: 'Natalia Cueva', cargo: 'Gerente de Tienda', telefono: '955020107' }),
    sede(RETAIL, 'TIENDA_SURCO', 'Av. Ejemplo 460, Santiago de Surco', { distrito: 'Santiago de Surco', provincia: 'Lima', departamento: 'Lima' }, { nombre: 'Óscar Benites', cargo: 'Gerente de Tienda', telefono: '955020108' }),
    sede(RETAIL, 'CENTRO_DISTRIB', 'Av. Ejemplo 1200, Lurín', { distrito: 'Lurín', provincia: 'Lima', departamento: 'Lima' }, { nombre: 'Iván Salas', cargo: 'Jefe de Distribución', telefono: '955020109' }, 'Ingreso de vehículos con cita previa.'),
    sede(EDUCA, 'SEDE_PRIMARIA', 'Jr. Ejemplo 560, Santiago de Surco', { distrito: 'Santiago de Surco', provincia: 'Lima', departamento: 'Lima' }, { nombre: 'Elena Quispe', cargo: 'Directora Administrativa', telefono: '955020110' }, 'Aplicaciones fuera del horario de clases.'),
    sede(EDUCA, 'SEDE_SECUNDARIA', 'Jr. Ejemplo 580, Santiago de Surco', { distrito: 'Santiago de Surco', provincia: 'Lima', departamento: 'Lima' }, { nombre: 'Víctor Arce', cargo: 'Jefe de Mantenimiento', telefono: '955020111' }),
    sede(HOTEL, 'HOTEL_CUSCO', 'Av. Ejemplo 670, Cusco', { distrito: 'Cusco', provincia: 'Cusco', departamento: 'Cusco' }, { nombre: 'Rocío Yupanqui', cargo: 'Jefa de Ama de Llaves', telefono: '955020112' }),
    sede(LOGIS, 'PATIO_CALLAO', 'Av. Ejemplo 780, Callao', { distrito: 'Callao', provincia: 'Callao', departamento: 'Callao' }, { nombre: 'Sofía Linares', cargo: 'Jefa de Flota', telefono: '955020113' }),
    sede(LOGIS, 'TERMINAL_LIMA', 'Av. Ejemplo 790, La Victoria', { distrito: 'La Victoria', provincia: 'Lima', departamento: 'Lima' }, { nombre: 'Jorge Medina', cargo: 'Jefe de Terminal', telefono: '955020114' }),
    sede(AGRO, 'PACKING_ICA', 'Carretera Ejemplo km 12, Ica', { distrito: 'Ica', provincia: 'Ica', departamento: 'Ica' }, { nombre: 'Daniel Rojas', cargo: 'Jefe de Inocuidad', telefono: '955020115' }, 'Protocolo de higiene obligatorio en el ingreso.'),
    sede(AGRO, 'FUNDO_CHINCHA', 'Camino Ejemplo s/n, Chincha Alta', { distrito: 'Chincha Alta', provincia: 'Chincha', departamento: 'Ica' }, { nombre: 'Mario Quiroz', cargo: 'Administrador de Fundo', telefono: '955020116' }),
    sede(FARMA, 'PLANTA_LURIN', 'Av. Ejemplo 890, Lurín', { distrito: 'Lurín', provincia: 'Lima', departamento: 'Lima' }, { nombre: 'Patricia Neyra', cargo: 'Directora Técnica', telefono: '955020117' }, 'Áreas de producción con ingreso controlado.'),
    sede(ENERGIA, 'SUBESTACION_PIURA', 'Carretera Ejemplo km 8, Piura', { distrito: 'Castilla', provincia: 'Piura', departamento: 'Piura' }, { nombre: 'Luis Chávez', cargo: 'Jefe de Planta', telefono: '955020118' }),
    sede(ENERGIA, 'OFICINA_PIURA', 'Av. Ejemplo 910, Piura', { distrito: 'Piura', provincia: 'Piura', departamento: 'Piura' }, { nombre: 'Karina Sandoval', cargo: 'Asistente Administrativa', telefono: '955020119' }),
    sede(MUNI, 'PALACIO_MUNICIPAL', 'Plaza Ejemplo s/n, Huancayo', { distrito: 'Huancayo', provincia: 'Huancayo', departamento: 'Junín' }, { nombre: 'Gloria Camposano', cargo: 'Gerente de Servicios Públicos', telefono: '955020120' }),
    sede(MUNI, 'MERCADO_MUNICIPAL', 'Jr. Ejemplo 230, Huancayo', { distrito: 'Huancayo', provincia: 'Huancayo', departamento: 'Junín' }, { nombre: 'Samuel Poma', cargo: 'Administrador del Mercado', telefono: '955020121' }, 'Atender antes de las 6:00 a. m., con el mercado cerrado.'),
    sede(MUNI, 'CAMAL_MUNICIPAL', 'Camino Ejemplo s/n, El Tambo', { distrito: 'El Tambo', provincia: 'Huancayo', departamento: 'Junín' }, { nombre: 'Esteban Alanya', cargo: 'Jefe del Camal', telefono: '955020122' }),
    sede(RESTO, 'LOCAL_TRUJILLO', 'Calle Ejemplo 120, Trujillo', { distrito: 'Trujillo', provincia: 'Trujillo', departamento: 'La Libertad' }, { nombre: 'Andrés Vargas', cargo: 'Administrador', telefono: '955020123' }),
  ],

  servicios: [
    servicio(PAMPA, 'PLANTA_ATE', 'DRT', 'MENSUAL', 4500, 4200, { insumos: [BRODI, BROMA], equipos: [KIT_EPP], certificadoDias: 90 }),
    servicio(PAMPA, 'PLANTA_ATE', 'DSS', 'QUINCENAL', 4500, 3800, { insumos: [CIPER, IMIDA], equipos: [MOTOMOCHILA, ASPERSORA_10] }),
    servicio(PAMPA, 'PLANTA_ATE', 'LTG', 'TRIMESTRAL', 60, 40, { insumos: [ENZIM], equipos: [HIDROLAVADORA], certificadoDias: 90 }),
    servicio(PAMPA, 'ALMACEN_CALLAO', 'DRT', 'MENSUAL', 2800, 2600, { insumos: [BRODI], equipos: [KIT_EPP] }),
    servicio(PAMPA, 'ALMACEN_CALLAO', 'DSS', 'MENSUAL', 2800, 2200, { insumos: [DELTA], equipos: [ASPERSORA_20] }),
    servicio(ANDES, 'CAMPAMENTO_BASE', 'DSF', 'SEMANAL', 1800, 1500, { insumos: [CUAT], equipos: [NEBULIZADOR, ASPERSORA_20] }),
    servicio(ANDES, 'CAMPAMENTO_BASE', 'LRA', 'SEMESTRAL', 85, 85, { insumos: [HIPO], equipos: [HIDROLAVADORA, MEDIDOR_CLORO], certificadoDias: 180 }),
    servicio(ANDES, 'CAMPAMENTO_BASE', 'LTS', 'ANUAL', 30, 30, { insumos: [ENZIM, HIPO], equipos: [BOMBA_LODOS, CAMARA], certificadoDias: 365 }),
    servicio(ANDES, 'COMEDOR_MINA', 'DSS', 'QUINCENAL', 650, 600, { insumos: [LAMBDA, IMIDA], equipos: [ASPERSORA_10] }),
    servicio(ANDES, 'COMEDOR_MINA', 'DRT', 'MENSUAL', 650, 650, { insumos: [BROMA], equipos: [KIT_EPP] }),
    servicio(SALUD, 'CLINICA_CENTRAL', 'DSF', 'DIARIA', 3200, 2900, { insumos: [CUAT, PEROX], equipos: [NEBULIZADOR], certificadoDias: 30 }),
    servicio(SALUD, 'CLINICA_CENTRAL', 'DSS', 'MENSUAL', 3200, 3000, { insumos: [IMIDA], equipos: [ASPERSORA_10] }),
    servicio(SALUD, 'CLINICA_CENTRAL', 'LRA', 'SEMESTRAL', 120, 120, { insumos: [HIPO], equipos: [HIDROLAVADORA, MEDIDOR_CLORO], certificadoDias: 180 }),
    servicio(SALUD, 'LABORATORIO', 'DSF', 'SEMANAL', 420, 420, { insumos: [CUAT], equipos: [NEBULIZADOR] }),
    servicio(SALUD, 'LABORATORIO', 'LAM', 'SEMANAL', 420, 400, { insumos: [CUAT] }),
    servicio(RETAIL, 'TIENDA_MIRAFLORES', 'DRT', 'MENSUAL', 1500, 1400, { insumos: [BRODI], equipos: [KIT_EPP] }),
    servicio(RETAIL, 'TIENDA_MIRAFLORES', 'DSS', 'QUINCENAL', 1500, 1300, { insumos: [CIPER, IMIDA], equipos: [MOTOMOCHILA] }),
    servicio(RETAIL, 'TIENDA_SURCO', 'DRT', 'MENSUAL', 1700, 1600, { insumos: [BROMA], equipos: [KIT_EPP] }),
    servicio(RETAIL, 'TIENDA_SURCO', 'LTG', 'TRIMESTRAL', 40, 30, { insumos: [ENZIM], equipos: [HIDROLAVADORA] }),
    servicio(RETAIL, 'CENTRO_DISTRIB', 'DRT', 'QUINCENAL', 12000, 11000, { insumos: [BRODI, BROMA], equipos: [KIT_EPP] }),
    servicio(RETAIL, 'CENTRO_DISTRIB', 'DSS', 'MENSUAL', 12000, 9000, { insumos: [CIPER, DELTA], equipos: [MOTOMOCHILA, NEBULIZADOR] }),
    servicio(RETAIL, 'CENTRO_DISTRIB', 'DSF', 'TRIMESTRAL', 12000, 8000, { insumos: [CUAT], equipos: [NEBULIZADOR], certificadoDias: 90 }),
    servicio(EDUCA, 'SEDE_PRIMARIA', 'DSF', 'MENSUAL', 2400, 2100, { insumos: [CUAT], equipos: [NEBULIZADOR], certificadoDias: 60 }),
    servicio(EDUCA, 'SEDE_PRIMARIA', 'LAM', 'SEMANAL', 2400, 1800, { insumos: [CUAT] }),
    servicio(EDUCA, 'SEDE_SECUNDARIA', 'DSS', 'BIMESTRAL', 3000, 2500, { insumos: [LAMBDA], equipos: [ASPERSORA_20] }),
    servicio(EDUCA, 'SEDE_SECUNDARIA', 'LRA', 'SEMESTRAL', 70, 70, { insumos: [HIPO], equipos: [HIDROLAVADORA], certificadoDias: 180 }),
    servicio(HOTEL, 'HOTEL_CUSCO', 'DSS', 'QUINCENAL', 3600, 3000, { insumos: [CIPER, FIPRO], equipos: [MOTOMOCHILA, ASPERSORA_10] }),
    servicio(HOTEL, 'HOTEL_CUSCO', 'DRT', 'MENSUAL', 3600, 3400, { insumos: [BRODI], equipos: [KIT_EPP] }),
    servicio(HOTEL, 'HOTEL_CUSCO', 'LTG', 'TRIMESTRAL', 50, 40, { insumos: [ENZIM], equipos: [HIDROLAVADORA], certificadoDias: 90 }),
    servicio(LOGIS, 'PATIO_CALLAO', 'DRT', 'QUINCENAL', 8000, 7000, { insumos: [BRODI, BROMA], equipos: [KIT_EPP] }),
    servicio(LOGIS, 'PATIO_CALLAO', 'DSS', 'MENSUAL', 8000, 6000, { insumos: [DELTA], equipos: [MOTOMOCHILA] }),
    servicio(LOGIS, 'TERMINAL_LIMA', 'DSF', 'MENSUAL', 1500, 1300, { insumos: [CUAT], equipos: [NEBULIZADOR] }),
    servicio(LOGIS, 'TERMINAL_LIMA', 'LTS', 'ANUAL', 25, 25, { insumos: [ENZIM], equipos: [BOMBA_LODOS], certificadoDias: 365 }),
    servicio(AGRO, 'PACKING_ICA', 'DRT', 'SEMANAL', 5200, 5000, { insumos: [BRODI, BROMA], equipos: [KIT_EPP] }),
    servicio(AGRO, 'PACKING_ICA', 'DSS', 'QUINCENAL', 5200, 4500, { insumos: [CIPER, IMIDA], equipos: [MOTOMOCHILA, TERMOHIGROMETRO] }),
    servicio(AGRO, 'PACKING_ICA', 'DSF', 'MENSUAL', 5200, 4800, { insumos: [CUAT, PEROX], equipos: [NEBULIZADOR], certificadoDias: 30 }),
    servicio(AGRO, 'FUNDO_CHINCHA', 'DRT', 'MENSUAL', 20000, 15000, { insumos: [BRODI], equipos: [KIT_EPP] }),
    servicio(AGRO, 'FUNDO_CHINCHA', 'DSS', 'TRIMESTRAL', 20000, 5000, { insumos: [BTI], equipos: [ASPERSORA_20] }),
    servicio(FARMA, 'PLANTA_LURIN', 'DSF', 'SEMANAL', 3800, 3800, { insumos: [CUAT, PEROX], equipos: [NEBULIZADOR], certificadoDias: 30 }),
    servicio(FARMA, 'PLANTA_LURIN', 'DRT', 'QUINCENAL', 3800, 3600, { insumos: [BROMA], equipos: [KIT_EPP] }),
    servicio(FARMA, 'PLANTA_LURIN', 'DSS', 'QUINCENAL', 3800, 3200, { insumos: [IMIDA, FIPRO], equipos: [ASPERSORA_10] }),
    servicio(ENERGIA, 'SUBESTACION_PIURA', 'DRT', 'TRIMESTRAL', 900, 900, { insumos: [BRODI], equipos: [KIT_EPP] }),
    servicio(ENERGIA, 'SUBESTACION_PIURA', 'DSS', 'SEMESTRAL', 900, 700, { insumos: [DELTA], equipos: [ASPERSORA_20] }),
    servicio(ENERGIA, 'OFICINA_PIURA', 'LAM', 'SEMANAL', 300, 280, { insumos: [CUAT] }),
    servicio(ENERGIA, 'OFICINA_PIURA', 'DSF', 'MENSUAL', 300, 300, { insumos: [CUAT], equipos: [NEBULIZADOR] }),
    servicio(MUNI, 'PALACIO_MUNICIPAL', 'DSS', 'TRIMESTRAL', 1800, 1500, { insumos: [LAMBDA], equipos: [ASPERSORA_20] }),
    servicio(MUNI, 'PALACIO_MUNICIPAL', 'LRA', 'SEMESTRAL', 60, 60, { insumos: [HIPO], equipos: [HIDROLAVADORA], certificadoDias: 180 }),
    servicio(MUNI, 'MERCADO_MUNICIPAL', 'DRT', 'QUINCENAL', 2200, 2200, { insumos: [BRODI, BROMA], equipos: [KIT_EPP] }),
    servicio(MUNI, 'MERCADO_MUNICIPAL', 'DSS', 'QUINCENAL', 2200, 2000, { insumos: [CIPER], equipos: [MOTOMOCHILA] }),
    servicio(MUNI, 'MERCADO_MUNICIPAL', 'LTG', 'MENSUAL', 80, 60, { insumos: [ENZIM], equipos: [HIDROLAVADORA] }),
    servicio(MUNI, 'CAMAL_MUNICIPAL', 'DSF', 'SEMANAL', 900, 800, { insumos: [HIPO, CUAT], equipos: [NEBULIZADOR] }),
    servicio(MUNI, 'CAMAL_MUNICIPAL', 'DRT', 'MENSUAL', 900, 900, { insumos: [BROMA], equipos: [KIT_EPP] }),
    servicio(MUNI, 'CAMAL_MUNICIPAL', 'DSS', 'PUNTUAL', 900, 900, { insumos: [LAMBDA, BTI], equipos: [MOTOMOCHILA] }),
    servicio(RESTO, 'LOCAL_TRUJILLO', 'DRT', 'MENSUAL', 350, 350, { insumos: [BRODI], equipos: [KIT_EPP] }),
    servicio(RESTO, 'LOCAL_TRUJILLO', 'DSS', 'QUINCENAL', 350, 300, { insumos: [IMIDA], equipos: [ASPERSORA_10] }),
    servicio(RESTO, 'LOCAL_TRUJILLO', 'LTG', 'MENSUAL', 12, 12, { insumos: [ENZIM], equipos: [HIDROLAVADORA] }),
  ],

  insumos: INSUMOS,
  equipos: EQUIPOS,

  // DNI ficticios (99...), teléfonos de ejemplo y usuarios "demo.*": son los que usan la demo y QA para entrar con cada rol.
  personal: [
    { dni: '99000001', nombres: 'Administrador', apellidos: 'Demo Gafer', cargo: 'ADMINISTRADOR', telefono: '955030001', usuario: 'demo.admin' },
    { dni: '99000002', nombres: 'Supervisor', apellidos: 'Demo Gafer', cargo: 'SUPERVISOR', telefono: '955030002', usuario: 'demo.supervisor' },
    { dni: '99000003', nombres: 'Tecnico Uno', apellidos: 'Demo Gafer', cargo: 'TECNICO_OPERADOR', telefono: '955030003', usuario: 'demo.tecnico1' },
    { dni: '99000004', nombres: 'Tecnico Dos', apellidos: 'Demo Gafer', cargo: 'TECNICO_OPERADOR', telefono: '955030004', usuario: 'demo.tecnico2' },
    { dni: '99000005', nombres: 'Tecnico Tres', apellidos: 'Demo Gafer', cargo: 'TECNICO_OPERADOR', telefono: '955030005', usuario: 'demo.tecnico3' },
  ],

  catalogos: {
    hallazgos: [
      'Actividad de roedores en el área de carga',
      'Madrigueras activas en el perímetro exterior',
      'Huellas y marcas de roce en paredes',
      'Excretas antiguas sin actividad reciente',
      'Cebos consumidos parcialmente',
      'Cebos consumidos totalmente',
      'Presencia de cucarachas en cocina',
      'Presencia de moscas en la zona de residuos',
      'Hormigas en la zona de almacenamiento',
      'Infestación leve de insectos rastreros',
      'Trampas de pegamento con captura',
      'Agua estancada con presencia de larvas',
      'Acumulación de grasa en la trampa',
      'Sarro y sedimentos en el reservorio',
    ],
    'acciones-correctivas': [
      'Instalación de estaciones adicionales de monitoreo',
      'Reemplazo de cebo deteriorado',
      'Aplicación focalizada de insecticida residual',
      'Sellado de grietas y rendijas en paredes',
      'Colocación de barrido en puertas',
      'Limpieza profunda de la zona afectada',
      'Retiro de residuos acumulados',
      'Aumento de la frecuencia de visitas',
      'Cambio de trampas de pegamento',
      'Desinfección de la zona intervenida',
      'Aplicación de larvicida en agua estancada',
      'Evacuación de lodos y lavado del tanque',
    ],
    observaciones: [
      'Ingreso restringido por actividad del cliente',
      'Falta de iluminación en la zona de inspección',
      'Producto almacenado directamente sobre el piso',
      'Puertas sin sello inferior',
      'Rejillas de desagüe sin tapa',
      'Personal del cliente acompaña la inspección',
      'Estaciones obstruidas por mercadería',
      'Área en remodelación durante la visita',
      'Condiciones climáticas adversas durante el servicio',
      'Contenedores de basura sin tapa',
      'Se requiere autorización para acceder a la azotea',
      'Equipo del cliente apagado durante la aplicación',
    ],
    recomendaciones: [
      'Mantener las puertas cerradas fuera del horario de operación',
      'Separar los productos del piso y de las paredes',
      'Retirar los residuos al término de cada turno',
      'Instalar mallas en ventanas y ductos',
      'Reparar goteras y fugas de agua',
      'Mantener los contenedores de basura tapados',
      'Limpiar de inmediato los derrames de alimentos',
      'Eliminar materiales en desuso acumulados',
      'Podar la vegetación cercana al perímetro',
      'Mantener libre el acceso a las estaciones de cebado',
      'Programar la limpieza de campanas y trampas de grasa',
      'Limpiar los tanques con la frecuencia indicada',
    ],
    giros: ['Minería', 'Retail', 'Hotelería', 'Agroindustria', 'Farmacéutica', 'Restaurantes'],
  },

  // Igual al que siembran las migraciones: sobre una base migrada no cambia nada (solo se completa si estuviera vacío).
  directorTecnico: { nombre: 'Ing. Carlos Medina Ruiz', cip: '84512' },
};
