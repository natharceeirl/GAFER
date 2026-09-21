import type { DocumentoDetalle, DocumentoResumen } from './tipos';

export const DOCUMENTOS_MOCK: DocumentoResumen[] = [
  { id: 'd1', codigo: 'INFORME-KALLPA-014-2026', cliente: 'KALLPA', proyecto: 'PLANTA', tipo: 'INFORME', estado: 'ENVIADO_A_REVISION', fecha: '2026-09-15' },
  { id: 'd2', codigo: 'REPORTE-KALLPA-005-2026', cliente: 'KALLPA', proyecto: 'CSF_SUNNY', tipo: 'REPORTE', estado: 'ENVIADO_A_REVISION', fecha: '2026-09-16' },
  { id: 'd3', codigo: 'INFORME-SAMAY-031-2026', cliente: 'SAMAY', proyecto: 'ALMACEN', tipo: 'INFORME', estado: 'OBSERVADO', fecha: '2026-09-14' },
  { id: 'd4', codigo: 'INFORME-PETROPERU-002-2026', cliente: 'PETROPERU', proyecto: 'REFINERIA_NORTE', tipo: 'INFORME', estado: 'APROBADO', fecha: '2026-09-12' },
  { id: 'd5', codigo: 'REPORTE-VARIOS-118-2026', cliente: 'VARIOS', proyecto: 'MINA_ANDINA', tipo: 'REPORTE', estado: 'ENVIADO', fecha: '2026-09-10' },
  { id: 'd6', codigo: 'INFORME-KALLPA-013-2026', cliente: 'KALLPA', proyecto: 'PLANTA', tipo: 'INFORME', estado: 'CERRADO', fecha: '2026-09-17' },
  { id: 'd7', codigo: 'INFORME-SAMAY-030-2026', cliente: 'SAMAY', proyecto: 'ALMACEN', tipo: 'INFORME', estado: 'BORRADOR', fecha: '2026-09-17' },
];

export const DOCUMENTOS_DETALLE_MOCK: Record<string, DocumentoDetalle> = {
  d1: {
    ...DOCUMENTOS_MOCK[0],
    diagnostico: 'Presencia moderada de roedores en zona de almacén de insumos. Sin evidencia de plagas rastreras.',
    trabajosRealizados: 'Desratización perimetral e interior según programa quincenal. Reposición de cebo en 6 estaciones.',
    insumosUsados: [
      { producto: 'Brodifacoum 0.005% bloque', lote: 'L-2451', cantidad: '600 g', concentracion: '0.005%' },
      { producto: 'Cipermetrina 25% EC', lote: 'L-2298', cantidad: '2 L', concentracion: '10 ml/L' },
    ],
    personal: [
      { nombre: 'Marco Ipusari', cargo: 'Técnico Operador' },
      { nombre: 'Diana Amamani', cargo: 'Supervisor' },
    ],
    accionesCorrectivas: ['Sellado de perforación en muro sur', 'Reubicación de estación 04 por acceso restringido'],
    observaciones: 'Acceso a zona de tanques restringido por mantenimiento programado, se reprograma para próxima visita.',
    recomendaciones: 'Mantener orden y limpieza en almacén de insumos, retirar cartones acumulados junto a estación 06.',
    fotos: 8,
    numeroCertificado: 'CERT-KALLPA-014-2026',
    vencimientoCertificado: '2026-12-15',
    firmaCliente: 'Rosa Contreras — Jefa de Planta',
  },
  d3: {
    ...DOCUMENTOS_MOCK[2],
    diagnostico: 'Actividad de roedores en incremento en zona de carga.',
    trabajosRealizados: 'Desratización según contrato mensual.',
    insumosUsados: [{ producto: 'Bromadiolona 0.005% pellet', lote: 'L-2510', cantidad: '400 g', concentracion: '0.005%' }],
    personal: [{ nombre: 'Jorge Huamán', cargo: 'Técnico Operador' }],
    accionesCorrectivas: ['Colocación de estación adicional en zona de carga'],
    observaciones: 'Falta fotografía de estación 09 según observación del Supervisor.',
    recomendaciones: 'Retirar residuos orgánicos acumulados junto al ingreso de carga.',
    fotos: 5,
    numeroCertificado: 'CERT-SAMAY-031-2026',
    vencimientoCertificado: '2026-11-30',
    firmaCliente: 'Luis Beltrán — Jefe de Almacén',
  },
};
