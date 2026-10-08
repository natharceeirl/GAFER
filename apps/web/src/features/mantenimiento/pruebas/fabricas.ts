import type { Equipo, Insumo, Personal } from '@gafer/contracts';

/** Insumo del catálogo con los códigos de la base de datos; `parcial` pisa lo que cada prueba necesite. */
export const insumoDePrueba = (parcial: Partial<Insumo> = {}): Insumo => ({
  id: '00000000-0000-4000-8000-000000000001',
  nombreComercial: 'Brodifacoum 0.005% bloque',
  principioActivo: 'Brodifacoum',
  presentacion: 'BLOQUE',
  unidadMedida: 'BLOQUE',
  registroDigesa: 'DIG-1',
  concentracion: '0.005%',
  dosisEstandar: '1 bloque por estación',
  fichaTecnicaKey: 'insumos/ficha-tecnica/prueba.pdf',
  hojaMsdsKey: 'insumos/hoja-msds/prueba.pdf',
  resolucionKey: null,
  proveedor: null,
  estado: 'ACTIVO',
  ...parcial,
});

/** Equipo del catálogo con los códigos de la base de datos; `parcial` pisa lo que cada prueba necesite. */
export const equipoDePrueba = (parcial: Partial<Equipo> = {}): Equipo => ({
  id: '11111111-0000-4000-8000-000000000001',
  codigoInterno: 'EQ-022',
  nombre: 'Aspersora de mochila',
  tipo: 'ASPERSION',
  marcaModelo: null,
  estadoOperativo: 'OPERATIVO',
  fechaAdquisicion: null,
  ultimoMantenimiento: null,
  proximoMantenimiento: null,
  ...parcial,
});

/** Persona del personal con los códigos de la base de datos; `parcial` pisa lo que cada prueba necesite. */
export const personalDePrueba = (parcial: Partial<Personal> = {}): Personal => ({
  id: '22222222-0000-4000-8000-000000000001',
  dni: '45892312',
  nombres: 'Marco',
  apellidos: 'Ipusari',
  cargo: 'TECNICO_OPERADOR',
  telefono: '958123456',
  usuario: null,
  estado: 'ACTIVO',
  ...parcial,
});
